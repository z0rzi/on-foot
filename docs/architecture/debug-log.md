# Debug log

The app keeps its own log in SQLite (`debug_log`, migration `0007_wild_sersi`), viewable and
shareable from Settings → Debug log. It exists because the app has no backend to report crashes
to: it is the **first place to look** for a bug reported from the field, and its first consumer
is FIELD-2 in `docs/reviews/2026-09-10-full-review.md` §5.1 — the sheet that is sometimes missing
after reopening.

## Table

| column    | type              | notes                                  |
|-----------|-------------------|-----------------------------------------|
| `id`      | integer, autoincrement | |
| `t`       | integer           | `Date.now()` at the time of the entry   |
| `level`   | text              | `'info' \| 'warn' \| 'error'`           |
| `area`    | text              | see below                               |
| `message` | text              | short, fixed phrase                     |
| `detail`  | text, nullable    | compact JSON, dropped if unserialisable |

`t` is indexed; the index serves both the newest-first viewer and the retention trim.

## Writing to it

`logEvent(level, area, message, detail?)` (`src/log/logEvent.ts`) is fire-and-forget: it never
returns a promise, so no caller awaits it or lets a logging failure affect app behaviour. Writes
go through their own serial queue, not the recording chain's, so a log write never waits behind a
recording turn or holds one up — and entries still land in the order they were logged. A failed
write is swallowed; the next entry still gets its turn.

Each entry is also mirrored to logcat as it is logged, before its write settles: one line under
`ReactNativeJS`, the mark `OnFootLog` then the entry as JSON (`logcatLine`, written by
`toLogcat` in `src/log/logcatSink.ts`, which Jest mocks globally in `jest.setup.js`). The mirror
is how a device check reads the log: the toolkit's recorder copies it from logcat into a file on
the host, the capture, for the whole of a check, and `devcheck log` reads that file
(`tools/device-check/appLog.ts` parses the mirror, held to the writer by a cross-check test;
`capture.ts` holds the capture's format). Only adb and the system read logcat, and an entry holds
no coordinate (below), so the mirror shows nothing the Share export does not.

## Areas

- **`recording`** — the recording lifecycle: start, pause, resume, segment boundaries, discard,
  finish, refusals (e.g. "start already-active"), and a failed read of the personal factor's
  history (`recordingStore`; the times fall back to factor 1).
- **`capture`** — the location stream: start/stop (`stream stopped` once a stop ends a running
  stream, nothing when none was running; `stream stop failed` (`warn`) `{ errorClass }` when it
  rejects, and the pause, discard, finish or launch that asked for it goes on), permission and
  location-off refusals, each fix
  batch (`fixBatchSummary`), a delivery that never reached the fix gate (`delivery fault`,
  `delivery waiting`, below), and interruption recovery decisions.
- **`launch`** — `runtime started` and cold start (below), the action `useResumeRecording` took,
  an interruption it detects (with its range), the moment that interruption is announced, once the
  map has loaded, and the preferences store's hydration failing (`preferences hydration failed,
  defaults used` (`warn`), `{ errorClass }`; the app runs on the defaults).
- **`map`** — the recording sheet mounting, every map-mode transition, the sheet settling on a snap
  point (`sheet settled`, with the mode and the index), the sheet/root/graph geometry sampled on
  `AppState` becoming `'active'` (`useSheetGeometryLog`), each hand-off of a destination to an
  external map app (`openMapApp`), a failed launch-time load of the offline packs (the offline
  maps list retries it on focus) or of the trails or activities store (`loadStoresAtLaunch`; a
  list's focus refresh or the next change retries it), and the launch camera falling back: the map store's hydration
  failing (with the error class) or timing out (with the bound), and a persisted
  launch camera ignored (with the fault: `missing`, `non-finite`, `out-of-range` or
  `unknown-follow-state`), the launch's camera choice and every fit of the camera to a route (below),
  the two route timing entries (below), the compass watch held while recording with the puck's
  mounts (below), the overview's lines and pins files and backfill (below), and a trail's offline
  download settling, once per trail whatever its number of packs (`offline download complete`, or
  `offline download failed` (`warn`), with the toast).
- **`error`** — uncaught errors (the global `ErrorUtils` handler, installed by `src/bootstrap` in
  every runtime, so a throw in a headless one lands here too), render errors caught by
  `ErrorBoundary`, and every failure or refusal the user is told about in an alert or a toast:
  start, pause, resume and stop recording, opening an activity while recording, saving or
  discarding an activity, saving a trail, opening the file picker, importing a GPX file or measuring
  its route, refreshing the trails or activities list, reloading the offline maps, deleting a trail or an activity, clearing the log, and the
  offline-download refusals (offline, not enough space, a trail with no route). A pack whose
  download fails once started logs `download failed` (`warn`) `{ stage }`: `start` when the kickoff
  rejects, with its `errorClass`; `progress` when the SDK reports it mid-download, with no class,
  since the port hands over only the SDK's message. The trail's outcome is the `map` entry above.
- **`hooks`** — one entry per check hook a device check sent (only a build made with
  `EXPO_PUBLIC_DEBUG_CHECK_HOOKS` has them; see `src/checkHooks/dispatcher.ts`): `hook <name>
  <outcome>`, the outcome `ok`, `refused`, `not-ready` or `busy`, or `failed` (`warn`)
  `{ errorClass }` when its core threw. No arguments and no reply data; an unknown hook is logged
  as `(unknown)`. A reply the receiver could not take logs `hook reply failed` (`warn`)
  `{ errorClass }` after the hook's own entry.

## The `fix batch` entry

One per delivery of fixes to a recording session (`capture`, `fixBatchSummary`), written once the
fix gate (`src/recording/fixGate.ts`) has judged them and the kept ones are stored:

| field | meaning |
|---|---|
| `arrived` | fixes in the delivery |
| `kept` | fixes stored as points |
| `droppedBeforeSegment` | fixes taken before the current segment began (a cached position after a restart) |
| `droppedAccuracy` | fixes rejected because their accuracy exceeded the gate's ceiling |
| `droppedJump` | fixes rejected as a jump from the segment's last point |
| `recovered` | fixes kept because they agreed with an earlier rejected fix against a wrong anchor |
| `firstAt`, `lastAt` | time of the first and last fix, to the second |
| `bestAccuracy` | the smallest accuracy in the delivery, or null when none is known |
| `worstRejectedAccuracy` | the largest accuracy the ceiling rejected, or null |
| `worstJump` | `{ metres, allowedMetres, seconds }` of the rejected jump that most exceeded its allowance, or null |
| `metresFromAnchor` | whole metres from the segment's last stored point to the first fix of the segment, kept or not, so a rejected jump still shows its size; null with no stored point or no fix in the segment |

A paused session or no session logs `fixes ignored, …` with `arrived` instead. A delivery whose
session read, anchor read or point write rejects logs `fix batch not stored` (`warn`) instead, with
`errorClass` and the fields above when the gate has run (a failed write, where `kept` is the size of
the hole in the track), or `arrived` alone when a read failed first. None of its fixes is stored or
shown, and the gate's recovery candidate stays the one the previous stored delivery left.

## The runtime entries

Android starts a JS runtime for a background location delivery without the app on screen (a
headless start), and the app opened later may land on that runtime still warm:

- `runtime started`, written by `src/bootstrap` before the background task is defined, in every
  runtime, headless or not. No detail.
- `cold start` `{ appVersion, build, runtimeAgeMs }`, once the navigation is ready
  (`useResumeRecording`): `build` is the identity the toolkit's `devcheck build` gave the build,
  commit, `uncommitted` (a hash, empty when clean) and native `fingerprint`, or null for a build
  made otherwise; `runtimeAgeMs` is the time since the runtime loaded the log, which bootstrap does
  first.

A `runtime started` with no `cold start` after it is a headless start; a `cold start` with a large
`runtimeAgeMs` is the app opened onto a warm runtime.

After `cold start`, `launch action <action>` `{ sessionId }` says what the launch did with the
durable session: `none` (no recording) or `held` (this runtime already shows the recording, as
after a swipe-away: nothing is cut, hydrated or restarted). Otherwise the runtime has not shown
it and the action is the relaunch's (`resumeActionFor`): `paused` (shown as paused), `continue`
(the session's last stored point, or its segment's start when later, is 30 s old or less: the
track goes on in the same segment, no toast) or `resume` (a real gap: a new segment starting just
after that moment, with `detected an interruption` `{ from, to }` and the toast). `continue` and
`resume` both restart capture.

## The launch camera and fit entries

What the camera was told to do, so a relaunch that frames the wrong view names its cause (T-84):

- `launch camera` `{ kind, mode, from }`, once per launch (`MapLaunchGate`): `kind` is `restore`
  (a free launch back on the last camera) or `follow`; `mode` is the follow mode, null on a
  restore; `from` says whether the launch starts on a last camera. A launch that fell back, after
  one of the warn entries above, reads `follow`, `position`, `from: false` or the fallback
  `launchCamera` named.
- `fit requested` `{ by, kind }`, from the map store's actions that ask for a fit: `by` is
  `select` (an entity was chosen to be shown) or `recenter` (the route was framed again), `kind`
  is `trail` or `activity`; or `{ by: 'cluster' }`, a tap on a cluster below the cap.
- `fit fired` `{ kind }`, when `MapCanvas` hands the fit to the camera, a frame after the
  entity's geometry has loaded (none to wait for with `kind` `bounds`, a cluster's starts) and the
  camera padding has settled. A request with no `fit fired` after it was replaced, cleared, or
  never got a geometry of two points.

None carries a camera centre, a box or an entity id.

## The route timing entries

Two entries split the cost of showing a route (T-4), each `{ kind, points, ms }`: `kind` is
`trail` or `activity`, `points` the point count over every segment, `ms` the duration to one
decimal.

- `route loaded`: the load of the selected entity, which is the SQLite read and the `JSON.parse`
  of its stored geometry (`timedRouteLoad`, wrapped around the loader in `useSelectedEntity`).
  Written once per load of the map's selection, so on a selection and again when a mutation
  makes the selection re-read; no other read of a trail or an activity writes it. An activity's
  load also reads its linked trail, when it has one, and that read is inside its `ms`. A load
  that finds nothing or fails writes none.
- `route derived`: the profile and banding pass of `useRouteDisplay`, written each time it runs
  for a trail or an activity, so on a selection and on a change of the smoothing preference. The
  live track's pass is not logged: it runs again on every fix batch.

## The overview entries

The overview's lines and pins reach the map as two files in the document directory, written by
the Mapbox adapter (`useOverviewFile`) once per burst of changes whose content differs from the
file's: the lines on a data change, the pins also on a selection, a toggle or a recording starting
or ending.

- `overview loaded` `{ trails, activities, points, ms }`: at each write of the lines file.
  `trails` and `activities` are the lines in it (an activity linked or not), `points` the
  positions over all of them, `ms` the time to join and write the file, to one decimal.
- `overview pins written` `{ pins, ms }`: at each write of the pins file. `pins` is the pins shown
  (none while recording), `ms` the time to build and write the file, to one decimal.
- `overview file write failed` (`warn`) `{ source, errorClass }`: the source keeps its previous
  file; the next change tries again. `source` is `lines` or `pins`.
- `overview files not cleared` (`warn`) `{ source, errorClass }`: listing or deleting the
  source's old files failed, at mount or after a switch; they are cleared at the next mount.
- `overview press` `{ pins, lines, clusters, outcome }`: at each press on the map, with the
  counts of the overview's pins, lines and clusters under the finger and what the press did:
  `select`, `deselect` (nothing under the finger, off the selected route: the selection cleared),
  `fit` (a cluster below the cap), `list` (the items under the finger listed), `name` (the toast
  while recording, shown or held back by its throttle) or `none`.
- `overview press failed` (`warn`) `{ errorClass }`: the press could not be read, as during a
  style reload, or handling it threw; nothing was selected.


Rows saved before overviews existed are filled by one pass at launch, once no recording session
exists (`overviewBackfill`).

- `overview backfill` `{ rows, failed, slowestMs, ms }`: once per pass that found rows to fill, at
  its end. `rows` is the rows filled, `failed` those of them whose stored geometry could not be
  read, stored with an empty overview so no later pass retries them, `slowestMs` the slowest row
  and `ms` the time spent on the rows, the frames between them excluded, both to one decimal. A
  launch with every row filled writes none.
- `overview geometry unreadable` (`warn`) `{ kind, errorClass }`: one per row counted in `failed`,
  `kind` being `trail` or `activity`.
- `overview backfill stopped` (`warn`) `{ rows, failed, errorClass }`: a read or a write failed
  and the pass ended there, with the counts so far and no `overview backfill` entry. The next
  launch resumes with the rows left.
- `reloading after the overview backfill failed` (`warn`) `{ kind, errorClass }`: the store
  reload that follows every few rows failed; the pass goes on.

## The heading entries

The puck's heading arrow is turned by the map SDK from a compass JS cannot read (T-89). While a
recording is in the recording phase and the app is active, `useHeadingLog` holds its own watch on
the compass through the location port (`watchHeading`) and writes, all under `map`:

- `heading watch` `{ on }` when the watch starts and stops. A watch that rejects writes
  `{ on: false, error }` once, as a warn, and is not retried until the next recording phase or
  return to the app.
- `heading sample` `{ updates, spreadDeg, accuracy, movedM }` every five minutes of one watch:
  the readings that arrived in the window, the arc that holds all of them in degrees to one
  decimal, the last calibration grade (0 to 3, null with no reading), and the metres of track
  recorded in the window.
- `heading stalled` `{ silentS, movedM }`, a warn, once: the compass has sent nothing since its
  last reading (since the start of the watch with none), that was at least 60 s ago, and the
  recording has moved at least 50 m since. `silentS` is that silence in whole seconds, `movedM`
  the metres recorded over it. A slow walker reaches the 50 m later; one standing still never.
- `heading resumed`, once, on the first reading after a stall.

The rule and the window are pure (`src/map/headingMonitor.ts`); the stall is looked for every
10 s. Each start of the watch begins a new window, so no sample and no stall spans a pause or a
stay in the background.

Android sends a reading only when the compass has turned about 2° since the last one. So
`updates` counts turns, not sensor ticks, one reading is already a compass that turned, and
silence is the only stall there is. A phone held perfectly steady along a straight line is
silent too and reads as a stall; the hand's sway on a walk is normally well over 2°. Without a
magnetometer, or without the location grant, the watch starts and sends nothing: `heading watch
{ on: true }` followed by samples of `updates: 0`.

`puck mounted` and `puck unmounted` are written by `UserPuckLayer`, the map-side component that
renders the port's puck.

No heading entry carries a position: `movedM` is a length of track.

## Deliveries that never reach the gate

A delivery of the background task can end before `fix batch` on two JS paths (T-95), both `warn`:

- `delivery fault` `{ fault, error }`: the location port could not hand the delivery over
  (`defineBackgroundFixHandler`, logged from `src/recording/locationTask.ts`). `fault` is `error`
  when the task manager reported one, with its message in `error`, or `empty` when the body held
  no location.
- `delivery waiting` `{ waiting, oldestS }`: a delivery arrived while an earlier one had been
  unsettled for more than 10 s, so a turn of the handler's serial queue is stuck and this
  delivery is held behind it (`deliveryWaiting`). `waiting` counts the deliveries held behind
  the oldest, the arriving one included; `oldestS` is how long the oldest has been pending, in
  whole seconds. Written at most once per 30 s.

A delivery dropped natively, before JS, writes neither: only logcat shows it (T-95). One whose
reads or write reject writes `fix batch not stored` (above).

## Errors in the log

An error enters the log by its class, never its message: `{ errorClass: errorClass(error) }`
(`src/log/errorClass.ts`), the `name` of an `Error` or the `typeof` of anything else thrown. A
message may quote the data at fault (a parse error the geometry it failed on, a database error the
row it refused); a class never does. The phrase and the other fields say what failed and where;
the class says which kind of failure it was.

Two kinds of entry keep a message, each for a reason the class cannot stand in for:

- **Native messages with no payload.** `delivery fault` and the rejected `heading watch` log the
  message the task manager or the heading module wrote. It describes the failure and carries no
  data, and the class alone would say nothing.
- **Uncaught errors** (`installGlobalErrorHandler`) log `{ message, stack }`, and **render errors**
  (`ErrorBoundary`) `{ message, stack, componentStack }`. Nobody anticipated them, so these are
  their only trace, and no failure the user is told about lands here.

`src/architecture/__tests__/logErrorDetail.test.ts` holds the rule: it reads the detail argument
of every `logEvent` call and fails on a `String(…)`, a `.message` or a `.stack` there, outside the
files in `LOG_MESSAGE_EXEMPT` (`src/architecture/logErrorDetail.ts`), each with its reason. An
exemption that stops covering a message fails too. The test reads the call's own arguments, so a
detail built before the call is not read and its file needs no exemption: the global handler builds
`{ message, stack }` first, and `delivery fault` receives the message as a string from the location
port. The rule binds where the check cannot see.

## No coordinates, ever

A position is logged as an accuracy and a distance from the previous point, never a latitude or
longitude (`fixBatchSummary`). The log must never become a record of where the user has been.

## Retention

Entries older than 7 days are deleted outright; of what's left, only the newest 5,000 are kept
(`sqliteLogRepository.trim` in `src/data/db/logRepository.ts`). The trim runs once per launch
(`useLogRetention`, wired in `app/_layout.tsx`), so the 5,000 cap is a launch-time bound, not a
continuous one: within one long-running process the table grows unbounded until the next launch
trims it.

## Getting it off the phone

Settings → Debug log → Share opens the system share sheet with the full text (`logExportText`): a
header (app version, phone model, Android version, the instant of the export), then every entry
newest-first, capped at 200,000 characters with a count of older entries left out if it doesn't all
fit. Because a log holds up to 7 days, every exported line is dated — `MM-DD HH:MM:SS`
(`formatCalendarClockSeconds`) — and the viewer states the date once at the top of each day instead
of on every row. One chip per area filters the viewer (all on when the screen opens, not
persisted); Share ignores the filter and exports every entry. Clear empties the table after
confirmation.

Over adb, `logcat -s ReactNativeJS` holds the mirror: every process of the app since logcat's
buffer began (about 45 s at the default 256 KiB on the owner's phone, which its location and
sensor services fill), nothing from before a reboot, and an entry past about 4 KB (a long stack)
cut short. A device check keeps it longer through the recorder's capture, from up to ten minutes
before its first command to its `cleanup`, which copies the capture into the check's evidence
folder. Clear empties the table,
not logcat.

## Known limits

- **Unhandled promise rejections are not captured.** React Native enables
  `promise/setimmediate/rejection-tracking` only under `__DEV__`
  (`node_modules/react-native/Libraries/Promise.js`); covering it in a release build would mean
  reaching into a transitive dependency's internals. Instead, each known rejection site logs its
  own failure.
- **The log records what the JavaScript side did.** A kill by the system leaves only the silence
  after the last entry — there is no entry announcing the death.
- **The `app active` sample is taken once, at the moment the app becomes active**
  (`useSheetGeometryLog`), and none is taken on a cold start (`AppState` emits no `'change'` when
  the app is already active before the screen mounts). It cannot distinguish "the sheet was
  already parked at the window height on reopen" from "it was fine at reopen and broke during the
  re-layout". So one healthy `app active` sample does not refute FIELD-2 — its broken state
  persists until a restart, so a later background→foreground cycle will still catch it. Accepted
  deliberately rather than adding a timer to device-verified rendering code.
- The header's app version is `expoConfig.version`, not the native build version.
