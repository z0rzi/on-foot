# Recording Stream Health — Design

**Status:** Approved design
**Branch:** `fix/recording-stream-health`
**Date:** 2026-09-12, revised 2026-09-15, approved 2026-09-16

## Goal

**A recording cannot start while device location is off. A recording already running survives location
being turned off, says so, and resumes capturing when it comes back. The app never shows a confident
"● Recording" while it knows it is not capturing, never leaves a location service running with no
recording behind it, and says so when a recording was interrupted.**

`src/recording/recordingController.ts` states the invariant in its header — *"A durable session must never
claim to be recording while nothing is streaming"* — and `startRecording`'s `catch` names the phantom
session. It is stated but not enforced: its only enforcement is `startLocationUpdatesAsync` rejecting, and
on Android it does not reject when location is merely off. This change rewrites that header, because
"recording while nothing streams" becomes an allowed, visible state.

**Reproduced by the user on-device:** disable device location, start a recording, enable location while it
runs. The timer runs, the Mapbox puck moves, and nothing is ever captured. It was first hit on a real hike;
the app had crashed and restarted before that recording began, and the recording was lost.

### Diagnosis — installed source (expo-location 57.0.11, expo-task-manager 57.0.12)

- **Start silently does nothing without a provider.** `startLocationUpdates` returns early when neither GPS
  nor network is enabled (`expo-location/…/taskConsumers/LocationTaskConsumer.kt:142-145`). The JS promise
  resolves, the task stays registered and `didRegister` still starts the foreground service (`:56-60`), but
  no request exists. Nothing re-issues one later: neither library listens for provider changes.
- **`hasStartedLocationUpdatesAsync` answers the wrong question for start.** It is `taskHasConsumerOfClass`
  — "is a task registered" — so the guards in `resumeRecording` and `resumeIfActive` skip the only call that
  could issue a request.
- **A restored task never gets its foreground service back.** Restore runs before the activity is
  foregrounded, and the consumer refuses to start the service while backgrounded (`:181-184`).
- **The foreground-service notification is invisible.** The app targets SDK 36 and never declares or requests
  `POST_NOTIFICATIONS`, so Android 13+ hides "Recording your activity".
- **The puck is not evidence.** It is `Mapbox.LocationPuck` (`src/map/providers/mapbox/adapter.tsx:76-79`),
  driven by the map SDK's own location engine.

### Diagnosis — measured on the user's phone (Android 13, release build)

- **2026-09-14, notification.** The service was listed in the quick-settings "active apps" panel while no
  notification appeared.
- **2026-09-14, crash mid-recording** (`adb shell am crash`). Android scheduled the service restart
  2,700,008 ms (45 min) out, then cancelled it (*"Stopping service due to app idle"*). No location delivery
  woke the app, and on reopening no `LocationTaskService` was running.
- **2026-09-15, a live request survives a location toggle.** With a recording running and the app in the
  background, Play Services listed the recording's request (`@2s HIGH_ACCURACY, minUpdateDistance=10.0`,
  `PendingIntent{740fb3}`) before the user turned location off and, **unchanged and never removed**, after
  turning it back on. While location was off Play Services shut its engine off; when location returned it
  resumed GPS for the app with no action from the app. This measured the request's liveness, not delivery.
- **2026-09-15, a point per reopen.** Swiping the app away and reopening it appended one point each time: the
  immediate position `resumeIfActive` requests on every launch. A plain Home-and-return added nothing.
- **Why swiping away re-runs launch code.** The foreground service keeps the process alive; only the React
  root remounts, so `useResumeRecording` runs again while the native stream never stopped. A recording row at
  launch therefore does **not** prove the process died. The in-memory store does: zustand state is module
  scope, so it survives a remount and is empty only in a fresh JavaScript runtime.

### What silence means (and why this design never reads it)

`RECORDING_OPTIONS.distanceInterval: 10` overrides the High-accuracy preset (`LocationHelpers.kt:116-118`)
and becomes the request's minimum update distance (`LocationHelpers.kt:49-54`). A hiker recording but
standing still receives no fixes; background batches need ≥ 15 s **and** ≥ 50 m (`LocationTaskConsumer.kt:322`);
native code can deliver a cached position through the task (`:86-93`). Silence is normal and a fix is not
proof of a live request, so nothing here is inferred from either.

## Existing shape

- **Pure derivations.** `recordingPhase` (`recordingStore.ts`), `resumeActionFor` (`resume.ts`),
  `applyPause` / `applyResume` / `movingElapsedMs` (`session.ts`) decide from state and are unit-tested.
  `recordingHealthFor` and `applyRelaunch` join them. `recordingHealthFor` differs in one declared way: it
  also takes platform-observed facts, passed in rather than fetched.
- **Controller operations.** `recordingController.ts` owns the durable-session / stream invariant and is
  tested with the native module mocked. `ensureStreaming` and `finishRecording` — the name ERR-1 in
  `docs/reviews/2026-09-10-full-review.md` already prescribes — live there.
- **App-lifetime handlers.** `app/_layout.tsx` mounts `ResumeRecordingHandler`; `RecordingStreamHandler` is
  mounted beside it and only forwards events.
- **Non-exceptional start outcomes.** `StartResult` is a union the caller renders
  (`src/map/RecordButton.tsx:38-51`); `'location-off'` joins it.
- **Retry and notices.** `src/components/ErrorBoundary.tsx`'s fallback offers a labelled "Try again"; the
  not-capturing state follows it. `showToast` (`src/components/toast.ts`) carries the interruption notice
  and the notification-denied hint.
- **Seams.** `src/net/` is the nearest precedent in form, but it is stateless; this port owns a background
  task and is a heavier boundary.

**New shape, stated plainly:** the codebase has no serialized-operation precedent. The controller's
single-flight chain is introduced because stream operations now arrive from both user actions and system
events.

## Scope

- **New** `src/location/` — the location port; registered as a seam in `src/architecture/seams.ts`.
- `src/recording/options.ts` — keeps the tuning values and notification copy.
- `src/recording/recordingController.ts` — the start flow, `ensureStreaming`, `finishRecording`, the chain,
  launch handling, start guards removed, all native calls through the port, header rewritten.
- `src/recording/recordingStore.ts` — `locationAvailable`, the stream's status (`stopped | live | faulted`),
  `resumeSettled`, all in memory.
- `src/recording/session.ts` — `applyRelaunch`.
- `src/recording/streamHealth.ts` (new) — `recordingHealthFor` and `recordingStatusText`.
- `src/recording/appActivity.ts` and `src/recording/notificationAccess.ts` (new) — waiting for the app to be
  active, and the notification request with its one-time hint.
- `src/recording/useRecordingStream.ts` (new) + `RecordingStreamHandler` in `app/_layout.tsx`.
- `src/recording/locationTask.ts`, `src/recording/track.ts` — through the port.
- `src/recording/RecordingInfoSheet.tsx` — the health line and retry.
- `src/map/RecordButton.tsx` — renders `'location-off'`; hidden until launch handling settles.
- `app/activity/save.tsx` — saves through `finishRecording`.
- `src/map/useLocationPermission.ts` — through the port.
- `app.config.ts` — declare `android.permission.POST_NOTIFICATIONS`; correct the stale comment at `:17-18`
  (it claims a *persisted* JobScheduler job; `patches/expo-task-manager+57.0.12.patch` set
  `setPersisted(false)`); keep `RECEIVE_BOOT_COMPLETED`, which expo-task-manager's boot receiver needs.
  `android/` is generated and gitignored, and `expo run:android` only prebuilds when that directory is absent
  (`node_modules/expo/node_modules/@expo/cli/build/src/run/ensureNativeProject.js`), so the change requires
  `npx expo prebuild -p android` before the next build.
- **ERR-1** — both halves of its prescribed fix: stop an orphaned task on launch, and save through
  `finishRecording`.

**Out of scope:**
- **Preventing a gap when the process dies mid-recording.** Nothing in JavaScript can act while the process is
  dead, and Android's own restart did not help (see measurements). This change **handles** the gap when the
  app is reopened; preventing it needs the crash causes fixed and a battery-optimisation exemption decision.
- **A custom bundle entry for the task handler.** `defineTask` only runs via `app/_layout.tsx`, a route module
  a headless start never evaluates, and expo-task-manager unregisters an undefined task that fires
  (`expo-task-manager/build/TaskManager.js:157-163`). Latent on a delayed-restart path; not observed.
- **A native `expo-location` patch.** Android broadcasts location toggles (`PROVIDERS_CHANGED_ACTION`) and Play
  Services sends availability intents to the task's `PendingIntent`, which expo-location ignores
  (`LocationTaskConsumer.kt:81-95`). Both are exposed to neither library's JavaScript; using them is deferred on
  cost.
- **The GPX import navigation bug** on `fix/gpx-no-route-guard`, and **ERR-4**.

## The change

### 1. A location port

`src/location/` owns `expo-location` and `expo-task-manager`, both registered with `allow: ['src/location/']`.

```ts
export interface LocationFix { lat: number; lng: number; ele: number | null; t: number }

export interface BackgroundTrackingOptions {
  minDistanceM: number
  batch: { intervalMs: number; distanceM: number }
  activity: 'fitness'
  notification: { title: string; body: string; color: string }
}


export function defineBackgroundFixHandler(handler: (fixes: LocationFix[]) => Promise<void>): void
export function startBackgroundTracking(options: BackgroundTrackingOptions): Promise<void>
export function stopBackgroundTracking(): Promise<void>
export function isLocationAvailable(): Promise<boolean>
export function promptToEnableLocation(): Promise<boolean>
export function hasForegroundAccess(): Promise<boolean>
export function requestForegroundAccess(): Promise<boolean>
export function requestBackgroundAccess(): Promise<boolean>
export function requestTrackingNotificationAccess(): Promise<'granted' | 'denied' | 'not-applicable'>
```

The port maps SDK objects to `LocationFix` (absorbing `track.ts`'s adapter) and options to SDK options at
`Accuracy.High`; `src/recording/options.ts` keeps the values, so the port imports neither the theme nor
domain copy. It owns the recording task's name, and `useLocationPermission` on the map uses it too.

**The contract, written on the port:**

- `startBackgroundTracking` registers the task, or restarts the request in place when it is registered
  (`expo-task-manager/…/TaskService.java:112-114` → `LocationTaskConsumer.kt:70-79`), starting a missing
  foreground service. It keeps the app-side batch buffer (`:169-174`) and re-posts the notification. It does
  **not** promise fixes: with no provider available it makes no request, and on a registered task it **first
  stops the live request, destroying it**. It rejects **before registering anything** when the app is not in
  the foreground (`expo-location/…/LocationModule.kt:326`); rejections pass through unchanged. A request that is live
  **survives a device location toggle** (measured 2026-09-15).
- `stopBackgroundTracking` unregisters when a task is registered and does nothing otherwise, since
  unregistering an absent task throws (`TaskService.java:127-128`). It does not swallow real failures.
- `isLocationAvailable` is `hasServicesEnabledAsync` — GPS or network enabled (`LocationHelpers.kt:144-148`) —
  **the exact predicate the native start uses**.
- `promptToEnableLocation` calls `enableNetworkProviderAsync` (`LocationModule.kt:287-308`) and returns
  `false` when it rejects: on decline, or without a dialog when settings cannot be resolved (`:564-579`). Its
  result is delivered only by `onActivityResult` (`:1087-1092`); nothing settles it if that never arrives
  (`OnDestroy`, `:388-391`), and while one is pending no further dialog is shown (`:543-551`). **Callers never
  hold other operations behind it.**
- `hasForegroundAccess` is the foreground location grant. A start with a foreground-service option needs only
  that (`LocationModule.kt:317-324`), so "All the time" is not required to capture.
- `requestTrackingNotificationAccess` returns `'not-applicable'` below Android 13 without asking, and otherwise
  calls `PermissionsAndroid.request(PERMISSIONS.POST_NOTIFICATIONS)`. Callers never gate recording on it: React
  Native resolves a non-grant without rationale as `NEVER_ASK_AGAIN`, including where the permission does not
  exist.

### 2. The single-flight chain

`startRecording`'s commit, `pauseRecording`, `resumeRecording`, `discardRecording`, `finishRecording`,
`linkTrailForSave`, launch handling and `ensureStreaming` each run as one turn of a single chain in the
controller: a turn waits for the previous one to settle and re-reads the session when it begins. At most one
`ensureStreaming` waits in the chain; a trigger arriving while one is already queued is dropped. **No turn
awaits a user-facing dialog** — prompts run before a turn is queued.

Every stream start inside a turn goes through one private step:

```text
issueStream:
  startBackgroundTracking(options)
    resolved → stream := live if await isLocationAvailable(), else stopped   (a start that raced location off made no request)
    rejected → stream := faulted('start-failed') if AppState is 'active', else stopped
```

A rejection while the app is not active is not reported: the sheet cannot be seen, and the next `active`
event retries.

### 3. Starting, pausing, resuming, saving

**`startRecording`:**

1. Outside the chain: the existing already-active and location-permission checks; then, when
   `isLocationAvailable` is false, `promptToEnableLocation` — declined or unavailable returns `'location-off'`,
   rendered as *"Location is off — turn on location to start recording."*
2. Outside the chain: `requestTrackingNotificationAccess`; on `'denied'`, one toast per process — *"Notifications
   are off, so Android won't show that On Foot is recording."* The recording proceeds either way.
3. Wait until `AppState` is `active`, since a dialog may just have closed.
4. One turn: re-check there is no active session, write the row, `beginSession`, `issueStream`. **A rejected
   start keeps the session**; the sheet shows "Not recording location" with retry. No phantom row can exist
   without location having been available or the user accepting the prompt.

**`resumeRecording`** is gated on location like `startRecording` — see
`2026-09-17-onfoot-rn-resume-location-gate-design.md`. After the gate, one turn commits the resume, then
`issueStream` when `isLocationAvailable`. A rejected start is a capture fault,
not a failed resume — the session is visibly recording, so the safe-state ordering it replaces has no purpose.

**`pauseRecording`** and **`discardRecording`** keep their policies (a pause tolerates a stop failure, a discard
propagates it) and record the stream as `stopped`. A pause thereby also drops a recorded fault: a paused session has
no stream, health ignores faults while paused, and resume derives a fresh status from a fresh start.

**`finishRecording(sessionId, input)`** (one turn): stop the stream, tolerating a stop failure as a pause does —
the saved activity matters more than a lingering service, which the next launch stops — then `saveActivity`,
then reset the store. `app/activity/save.tsx` calls it instead of touching recording state.

### 4. Launch

`resumeIfActive` is one turn, and `RecordButton` stays hidden until it settles (`resumeSettled`, set in a
`finally`), so Record cannot reach the save screen over a recording that has not loaded yet. The consequence is
symmetric: while that turn has not settled, Record is hidden, so a launch turn that never settles leaves the
user with no way to start a recording.

- **No session:** `stopBackgroundTracking` — an orphaned task from a failed stop or an unfinished save is stopped.
- **The store already holds the session:** the JavaScript runtime survived a root remount (the app was swiped
  away while its service kept the process alive). Nothing is hydrated, no segment starts, nothing is announced.
- **The store is empty and the row is recording:** the runtime died with the recording running. Hydrate from the
  row; `applyRelaunch` starts a new segment (`markResumed(id, pausedMs, currentSegment + 1)`), so the saved track
  is not joined across the gap by a straight line; toast *"Recording interrupted 13:56–14:40"*, from the last
  stored point's time (or the session start) to now; then `issueStream`, which also restores the foreground
  service a restored task never got.
- **The row is paused:** hydrate only.

The immediate one-shot position `resumeIfActive` appended on every launch is removed.

### 5. Recovery: `ensureStreaming`, only when needed

```text
ensureStreaming (one turn):
  session not recording                → nothing
  hasForegroundAccess is false         → stream := faulted('permission-missing'); nothing started
  a permission-missing fault           → stream := stopped  (the permission is back)
  locationAvailable := isLocationAvailable()
  location unavailable                 → nothing  (a start would destroy a live request)
  stream is live                       → nothing  (a live request survives location toggles)
  otherwise                            → issueStream
```

The stream is `live` only after a start that resolved with a provider available before and after it. It becomes
`stopped` on `beginSession`, `hydrate`, `reset`, a pause, a discard, a finish, and a start that raced location off;
it becomes `faulted` on a start rejected while the app is active, or on a missing foreground permission. It does
**not** change on observing location off, because the request survives that. The only request that can be dead
while the app runs is one started with no provider, and that is exactly a stream that is not `live`.

The stream's status is one value, not a flag beside a fault, so a faulted stream cannot also be live. Provider
availability stays a separate value because it varies independently: a request stays live while location is off.

`useRecordingStream`, mounted once as `RecordingStreamHandler`, forwards to `ensureStreaming` while the phase is
`recording`: `AppState` becoming `active`; `AppState` `focus` (the quick-settings shade pauses nothing, so it
produces no `change` event — `react-native/ReactAndroid/…/AppStateModule.kt:41-57`); the phase becoming
`recording`; and the sheet's retry. With a live stream each is one availability read and no restart.

### 6. The sheet

```ts
export type RecordingHealth =
  | { kind: 'idle' }            // no session: nothing is claimed
  | { kind: 'paused' }          // paused: nothing is claimed
  | { kind: 'location-off' }    // recording, no location provider available
  | { kind: 'not-capturing'; fault: 'start-failed' | 'permission-missing' }   // recording, provider available, and a start failed or foreground permission is missing
  | { kind: 'recording' }       // recording, nothing known to be wrong

export function recordingHealthFor(input: {
  phase: RecordingPhase
  locationAvailable: boolean | null
  stream: StreamStatus   // { kind: 'stopped' } | { kind: 'live' } | { kind: 'faulted'; fault }
}): RecordingHealth
```

`location-off` takes precedence over `not-capturing`: it names the cause. In place of `● Recording`,
`RecordingInfoSheet` shows *"Location is off — recording continues when it's back on"*, or *"Not recording
location"* with a labelled retry — adding *"Allow location access for On Foot in Settings"* for
`permission-missing`. The timer keeps running; nothing auto-stops or discards; paused never warns.

## Rejected alternatives

**Restarting the request on every return and every shade close** (this spec's third version, by decision, then
measured). A live request survives a location toggle, so the restart only mattered for starts made with no
provider — while each extra start re-issues a request that can hand back a fresh fix, `active` and `focus` both
fire on a single return, and in-app alerts and dialogs fire `focus` too.

**A jitter filter dropping fixes near the previous point.** Proposed to contain the cost above; unnecessary once
restarts are rare and the launch one-shot position is gone.

**Inferring a dead stream from silence** (first version): a stationary hiker gets no fixes under a 10 m minimum
update distance, and a fix is not proof of a live request. **Stop-then-start as recovery** (first version): stop
throws when nothing is registered, unregistering drops batched fixes, and a stop followed by a backgrounded start
leaves no stream. **Re-issuing only after observing location off** (second version): it trusted observation
instead of what a start was issued with, and the device master switch it read disagrees with the native start's
predicate. **A reconcile deciding inside a React hook**: it raced the controller's own operations.

**Holding the chain across prompts.** A dialog result that never arrives would block pause, resume and discard for
the rest of the process, and accepting the location dialog delivers its result before the app resumes — a start
issued immediately can be rejected as backgrounded.

**Requiring "All the time" location to capture.** The native start with a foreground service needs only the
foreground grant; requiring more would report "Not recording" over a working recording and block recovery.

**Treating a recording row at launch as proof of a dead process.** Swiping the app away remounts the React root
while the service keeps the process and its stream alive; that would announce false interruptions and break
segments needlessly.

**Bridging a relaunch gap with a straight line, silently** (by decision). **Discarding a session whose first start
fails** (by decision). **Allowing a recording to start with location off** (by decision). **Refusing a start whose
post-prompt re-check still reads off** (by decision). **Leaving the service notification hidden** (by decision).

**`AppState` `change` alone** misses the quick-settings shade; **polling** is superseded by events; **recovery owned
by `RecordingInfoSheet`** would not run on other tabs.

**A live flag beside a fault** (this spec's approved version, replaced after review). `streamLive` and
`captureFault` could contradict — live with the permission missing — so every fault and teardown site had to
remember to clear the flag. Three sites forgot; the last re-opened the phantom recording. **One union that also
folds in location off**: it would erase that a request stays live while location is off, and recovery would
re-issue a request that never died.

## Consequences accepted

- **A request that dies while the app runs, for a reason other than a start issued without a provider, is not
  re-issued** until the next launch or a retry. The measurement covered location toggles on one Android 13 phone
  and showed the request stays registered; delivery after a toggle was not measured.
- **A location-off period is bridged by a straight line** in the track: capture resumes on the surviving request,
  and the app does not know where the break belongs. A relaunch gap is not — it starts a new segment.
- **The timer counts an interrupted period**: elapsed time is still true, while pace over it reads slow.
- **A request started with location off, while the app stays in the background, is not re-issued** until the app
  is opened or its shade closed. The deferred native patch would close this.
- **`permission-missing` cannot be fixed from the app**; the sheet points to Settings and retry re-checks.
- **Declaring the notification permission needs `npx expo prebuild -p android`** before the next build.

## Test plan (Jest, written first)

`src/recording/__tests__/streamHealth.test.ts` — `recordingHealthFor`: idle → `idle`, paused → `paused`; recording +
provider unavailable → `location-off`, even with a faulted stream; recording + provider available + a faulted
stream → `not-capturing`; recording + available or `null` + no fault → `recording`.

`src/recording/__tests__/session.test.ts` — `applyRelaunch` advances `currentSegment` and leaves `startedAt`,
`pausedMs` and `pausedAt` unchanged.

`src/recording/__tests__/recordingStore.test.ts` — `beginSession`, `hydrate` and `reset` clear `locationAvailable`
and reset the stream to `stopped`.

`src/recording/__tests__/recordingController.test.ts` — rewritten against a **fake port**, not bare `jest.fn()`
mocks: registration state flips when a start or stop is *called*, and each read can be held open with a deferred
promise so the check-then-act window is real. It keeps the intent of the six existing tests.

- start: location unavailable and prompt declined → `'location-off'`, no row, no start;
- start: prompt accepted → `'started'` even when availability still reads false;
- start: a pause issued while the location prompt is pending completes without waiting for it;
- start: a notification denial does not block the start and shows the hint once;
- start: a rejected start keeps the session, with `start-failed` when active and no fault when not;
- `ensureStreaming`: a live stream → no start; not live + provider + foreground access → one start, `live`
  only when availability still holds after it; provider unavailable → no start; foreground access missing →
  `permission-missing`, no start; background access missing alone → starts;
- `ensureStreaming`: several triggers while one is queued → one start;
- **check-then-act:** an `ensureStreaming` whose availability read is held open while a pause settles issues no
  start; an `ensureStreaming` queued behind a pause starts nothing;
- `resumeRecording`: commits then starts; with location off commits and starts nothing; a rejected start is a
  capture fault and the resume stands;
- launch: no session + a registered task → stopped; store already holding the session → no hydrate, no segment,
  no toast, no start; empty store + recording row → hydrate, `markResumed` with the next segment, the interruption
  toast with times from the last stored point, one start, and no one-shot position;
- `finishRecording`: stops then saves and resets; a stop failure still saves;
- `pauseRecording` tolerates a stop failure; `discardRecording` propagates it (existing policy).

`useRecordingStream` only forwards events and gets no unit test — the React Native testing library was removed in
`a8e4793` — so every decision it triggers lives in tested controller code.

## Device verification

Run `npx expo prebuild -p android` first. Each step states the current build's result where it is known, so it
cannot pass while the defect survives.

1. **Notification.** First Record → a notification-permission prompt; grant → "Recording your activity" visible.
   *(Current build: never shown — observed 2026-09-14.)*
2. **Refused start.** Turn location off from the shade, press Record, decline the dialog → "Location is off" alert,
   no recording. *(Current build: a phantom recording starts.)*
3. **Accepted prompt.** Repeat and accept, several times → each recording starts and captures when walking.
4. **Resume while off.** Pause, turn location off from the shade, resume, staying in the app → "Location is off";
   turn location on from the shade → walk, the track resumes. *(Current build: capture never resumes — the resumed
   start is issued with no provider.)*
5. **Toggle mid-recording.** While recording, turn location off from the shade → "Location is off", timer running;
   turn it on → walk, the track resumes, and no restart happens (`adb shell dumpsys activity service
   com.google.android.gms` still lists the same recording `PendingIntent`).
6. **Relaunch after a crash.** Mid-recording, `adb shell am crash com.zorzi.onfootrn`, walk, reopen → the toast
   names the gap, the track shows a new segment instead of a straight line, `LocationTaskService` is in the
   foreground, and walking is captured. *(Current build: no service after reopening — observed 2026-09-14.)*
7. **Swipe away.** Mid-recording, swipe the app away and reopen it five times → no toast, no new segment, no new
   points while standing still. *(Current build: a point per reopen — observed 2026-09-15.)*
8. **No orphaned service.** Save a recording, then `adb shell dumpsys activity services com.zorzi.onfootrn` → no
   `LocationTaskService`. Relaunch the app mid-recording and confirm Record is not shown before the recording loads.
9. **Permission.** Mid-recording, set On Foot's location permission to "Don't allow" in Settings and return (the app
   may restart) → "Not recording location"; allow it again, return or tap retry → capture resumes.
10. **No churn.** Record while standing still for 3 minutes, unlocking the phone and opening the shade ten times →
    Distance stays at 0 m, no warning, and the notification never re-alerts.
11. **Paused.** Pause and wait 2 minutes → "⏸ Paused", no warning.

**Runtime checks still owed:** that a request surviving a toggle actually delivers fixes afterwards (steps 4–5 with
walking); that `focus` fires when the shade closes on the target phone (step 4); that accepting the location dialog
never rejects the first start (step 3).
