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

## Areas

- **`recording`** — the recording lifecycle: start, pause, resume, segment boundaries, discard,
  finish, and refusals (e.g. "start already-active").
- **`capture`** — the location stream: start/stop, permission and location-off refusals, each fix
  batch (`fixBatchSummary`), and interruption recovery decisions.
- **`launch`** — cold start, the action `useResumeRecording` took, and any interruption it
  announces.
- **`map`** — the recording sheet mounting, every map-mode transition, and the sheet/root/graph
  geometry sampled on `AppState` becoming `'active'` (`useSheetGeometryLog`).
- **`error`** — uncaught errors (the global `ErrorUtils` handler) and render errors caught by
  `ErrorBoundary`.

## No coordinates, ever

A position is logged as an accuracy and a distance from the previous point, never a latitude or
longitude (`fixBatchSummary`). The log must never become a record of where the user has been.

## Retention

Entries older than 7 days are deleted outright; of what's left, only the newest 5,000 are kept
(`sqliteLogRepository.trim` in `src/data/db/logRepository.ts`). The trim runs once per launch
(`useLogRetention`, wired in
`app/_layout.tsx`).

## Getting it off the phone

Settings → Debug log → Share opens the system share sheet with the full text
(`logExportText`): a header (app version, phone model, Android version), then every entry
newest-first, capped at 200,000 characters with a count of older entries left out if it doesn't
all fit. Clear empties the table after confirmation.

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
