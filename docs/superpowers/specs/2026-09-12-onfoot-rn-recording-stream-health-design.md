# Recording Stream Health — Design

**Status:** Approved design
**Branch:** `fix/recording-stream-health`
**Date:** 2026-09-12

## Goal

A recording must never claim to be capturing while nothing is streaming, and must recover on its
own when the stream can be restarted.

`src/recording/recordingController.ts` already states this invariant in its own header comment —
*"A durable session must never claim to be recording while nothing is streaming: that state shows
a live recording capturing no points, and the singleton row blocks starting a real one"* — and
`startRecording` even has a `catch` whose comment names the phantom by name. The invariant is
stated but not enforced, because its only enforcement is `startLocationUpdatesAsync` rejecting.

**Reproduced by the user on-device:** start a recording with device location **disabled**, then
enable location. The timer runs, the Mapbox puck moves, and no point is ever captured — distance
and elevation stay at zero for the rest of the session.

On Android the native `startLocationUpdates` returns silently when no location provider is
available, so the JS promise **resolves**, the task is registered, and the session is written.
Re-enabling location restores nothing: no provider-status listener, no `AppState` re-subscribe,
no staleness check exists anywhere in `src/`. The same dead end is reachable after a process
restart, which is how it was first hit, on a real hike, losing the recording.

Two further facts shape the design:

- `hasStartedLocationUpdatesAsync` — the guard `resumeRecording` and `resumeIfActive` rely on — is
  `taskHasConsumerOfClass`. It answers *"is a task with this name registered"*, never *"are fixes
  arriving"*. Both guards therefore skip the only call that could re-subscribe.
- The moving puck is not evidence. It is `Mapbox.LocationPuck`
  (`src/map/providers/mapbox/adapter.tsx:76-79`), driven by the map SDK's own location engine with
  no connection to `expo-location`.

## Existing shape

The closest existing shape is the **pure-derivation trio already in `src/recording/`**:
`recordingPhase(session)` in `recordingStore.ts`, `resumeActionFor(session)` in `resume.ts`, and
`movingElapsedMs(session, now)` in `session.ts`. Each takes durable state plus an instant and
returns a decision, each is unit-tested, and each is consumed by a component that renders it.
`streamHealthFor` is a fourth member of that family and is written to match it — same directory,
same purity, same test style. **Nothing new is extracted**: the pattern exists, and this is the
dimension it was never applied to.

The second shape is the **seam**. `src/architecture/seams.ts` declares three native boundaries —
map provider, persistence, connectivity (`src/net/`) — and `src/net/` is the direct precedent: a
small directory wrapping one native SDK, with consumers depending on a semantic status type. This
change adds a fourth of exactly that form for location. `expo-location` is used today from five
files across two directories (`src/map/useLocationPermission.ts`, `src/recording/locationTask.ts`,
`options.ts`, `recordingController.ts`, and the controller test), which is the drift a missing
boundary produces.

## Scope

- **New** `src/location/` — the port and its `expo-location` / `expo-task-manager` implementation.
- `src/architecture/seams.ts` — register the seam.
- `src/recording/streamHealth.ts` (new) — the pure derivation, plus its test.
- `src/recording/recordingStore.ts` — record `lastFixAt`.
- `src/recording/recordingController.ts` — one idempotent `ensureStreaming`, replacing three
  divergent call sites.
- `src/recording/locationTask.ts` — register the handler through the port.
- `src/recording/RecordingInfoSheet.tsx` — show health beside the phase.
- `src/map/useLocationPermission.ts` — use the port.

**Out of scope:** ERR-1 (the stop failure that orphans a stream) — the mirror of this bug and worth
its own change; the offline registry's swallowed init error (ERR-4), which is the same class of
silent-subsystem failure and the next place this pattern should go; anything on
`fix/gpx-no-route-guard`, which is unmerged and independent.

## The change

### 1. Location becomes a seam

`src/location/` owns `expo-location` and `expo-task-manager`. Both tokens are registered in
`SEAMS` with `allow: ['src/location/']`, so the existing `seams` test enforces the boundary.

The port exposes what consumers actually need, in app terms rather than SDK terms:

```ts
export interface LocationFix { lat: number; lng: number; ele: number | null; t: number }

export function defineBackgroundFixHandler(handler: (fixes: LocationFix[]) => Promise<void>): void
export function startBackgroundUpdates(): Promise<void>   // idempotent
export function stopBackgroundUpdates(): Promise<void>    // idempotent
export function isLocationEnabled(): Promise<boolean>     // hasServicesEnabledAsync
export function getCurrentFix(): Promise<LocationFix>
export function requestForegroundAccess(): Promise<boolean>
export function requestBackgroundAccess(): Promise<boolean>
```

The accuracy, batching and foreground-service tuning that is `RECORDING_OPTIONS` today moves
inside the port: `Location.Accuracy.High` and friends are provider-specific literals, and AGENTS.md
requires those stay behind the seam rather than leaking into shared code.

**The port's contract states what `startBackgroundUpdates` does not promise:** it registers a
request; it does not guarantee fixes will arrive, and it resolves even when the platform silently
declines. Writing that sentence down is what makes the rest of this design necessary — and it is
what a seam would have forced someone to notice before a hike did.

The background handler keeps its domain logic in `src/recording/locationTask.ts` (find the active
session, append points); only the registration and the fix shape come from the port.

### 2. The store records evidence

`recordingStore` gains `lastFixAt: number | null`, set by `appendLivePoints` — the one place fixes
enter the app. It is in-memory only; the store has no `persist` middleware and must not gain one,
because a remembered `lastFixAt` would assert liveness a new process cannot know.

`hydrate` resets it to `null`: after a restart we genuinely do not know whether the stream is
alive, and `waiting` is the honest answer until a fix arrives.

### 3. A pure derivation

```ts
export type StreamHealth =
  | { kind: 'live' }
  | { kind: 'waiting'; sinceMs: number }
  | { kind: 'stalled'; sinceMs: number }
  | { kind: 'off' }

export function streamHealthFor(input: {
  phase: RecordingPhase
  startedAt: number
  lastFixAt: number | null
  locationEnabled: boolean
  now: number
}): StreamHealth
```

`off` when the provider is disabled; `waiting` while no fix has arrived yet; `stalled` once the gap
since the last fix exceeds the grace period; `live` otherwise. Paused sessions are always `live` —
the background task deliberately ignores fixes while `pausedAt` is set, so silence is expected and
must not be reported as a fault.

The grace period is derived from the capture tuning rather than guessed: deferred delivery is
batched at 15 s, so a threshold of four batches (60 s) is the first point at which silence is
certainly not just batching. It is a named constant next to the derivation.

`waiting` and `stalled` are deliberately distinct: a session that has never received a fix is not
the same as one that was capturing and went quiet, and the copy differs. Both carry the elapsed
time, so the UI can age either one.

`locationEnabled` is an input, not something the derivation fetches. `isLocationEnabled()` is a
platform round-trip, so it is **not** read on the one-second tick. A small `useLocationEnabled`
hook in `src/recording/` refreshes it on mount, on every `AppState` foreground transition, and once
whenever the derivation would otherwise report `stalled` — that last read is what separates "the
provider is off" from "the provider is on and silent", and it is only needed at the moment the
distinction becomes visible. Until it resolves, `stalled` is the honest answer.

No new timer: `useMovingStopwatch` already ticks every second while recording, and the sheet
already re-renders on that tick.

### 4. One recovery policy

`ensureStreaming()` — idempotent, `stop` then `start` through the port — replaces the three
divergent call sites. The `hasStartedLocationUpdatesAsync` guards at `recordingController.ts:64`
and `:93` are **deleted**, not corrected: idempotency belongs in the port's contract, not in each
caller's memory, and those guards are the proximate bug.

It runs on start, on resume, on every foreground transition (`AppState`), and whenever health is
`stalled` or `off` and the provider has come back. The foreground hook repairs a second defect for
free: after a process restart the task is restored *before* the activity is foregrounded, so its
foreground service never starts; restarting while genuinely foregrounded starts it.

### 5. The user sees the truth

`RecordingInfoSheet` renders health where the phase is, replacing an unconditional `● Recording`:
"Waiting for GPS", "No GPS fix for 4 min", "Location is off". The timer stays — elapsed time is
still true — but reads as subordinate to the warning.

Nothing auto-stops or auto-discards: silently throwing away a session loses more than it saves.

## Rejected alternatives

**Keep the guards but fix them** (ask `hasServicesEnabledAsync` before trusting
`hasStartedLocationUpdatesAsync`). Treats the symptom. The guards exist to avoid a redundant
restart that is already cheap and idempotent, and any query about the platform's intent is a proxy
for the thing we can measure directly: whether fixes arrive.

**Have the port verify delivery before resolving** (start, then wait for a first fix, reject on
timeout). Makes `start` slow and failable in a way callers cannot act on — indoors a first fix can
take minutes legitimately. Liveness is a continuous property, not a startup check.

**Persist `lastFixAt`.** Would let a relaunch claim liveness it cannot know, which is this bug in a
new costume.

**A dedicated health poller.** A second interval beside the stopwatch, for a value only rendered
next to the timer.

## Consequences accepted

- **A false `stalled` is possible in a tunnel or dense forest**, where fixes legitimately stop for
  minutes. That is the correct message: the app is not capturing, and saying so is the point.
- **`ensureStreaming` on every foreground transition costs a stop/start cycle.** Idempotent, and
  cheap relative to a lost hike.
- **The port hides `expo-location` types from consumers**, so `LocationFix` must be mapped at the
  boundary; `toTrackPoint` moves to consume the port's shape rather than `Location.LocationObject`.
- **A one-shot `getCurrentFix` must not count as stream evidence.** `resumeIfActive` injects an
  immediate fix so the overlay is not empty; recorded as geometry, it would set `lastFixAt` and make
  a dead stream look `live` — precisely the reported bug wearing a disguise. It therefore appends
  points without touching `lastFixAt`, and that distinction is pinned by a test.

## Test plan (Jest, written first)

`src/recording/__tests__/streamHealth.test.ts` — the whole decision table:
- no fix yet, inside the grace period → `waiting`
- no fix yet, past the grace period → still `waiting`, never `stalled` (the distinction the UI copy
  depends on)
- a recent fix → `live`
- last fix older than the grace period → `stalled` with the elapsed gap
- provider disabled → `off`, whatever the fix history
- phase `paused` → `live` regardless of silence
- phase `idle` → `live` (nothing is claimed, so nothing can be wrong)

`src/recording/__tests__/recordingStore.test.ts` — `appendLivePoints` sets `lastFixAt`; an empty
batch leaves it unchanged; `hydrate` and `reset` clear it.

`src/recording/__tests__/recordingController.test.ts` — the existing suite mocks
`hasStartedLocationUpdatesAsync`, which bakes the false equivalence between *registered* and
*streaming* into the tests and is why they could never have caught this. It is rewritten against a
**fake location port**: start/stop counts, and a fake that accepts `start` while delivering
nothing, which is the field failure as a unit test.
- `startRecording` starts the stream through the port
- `resumeRecording` and `resumeIfActive` restart unconditionally, with no registration query
- `ensureStreaming` is idempotent across repeated calls
- a one-shot resume fix appends geometry without setting `lastFixAt`

## Device verification

- **The reported repro:** disable device location, start a recording, then re-enable location.
  Expect "Location is off" while disabled, and capture to begin within a batch of re-enabling.
- Start a normal recording outdoors: "● Recording", track draws, distance climbs.
- Background the app mid-recording and return: capture continues, notification present throughout.
- Force-stop the app mid-recording and relaunch: the session resumes, health reads `waiting` then
  `live`, and the foreground-service notification is present.
- Pause a recording and wait two minutes: it must keep reading "⏸ Paused", never "No GPS fix".
