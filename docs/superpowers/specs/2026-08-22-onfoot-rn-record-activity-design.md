# Record & Save an Activity — Design

## Goal

Let the user record their live GPS trail as they move, then name/rate/annotate and
save it as an **activity**. Recording runs in the background (screen off, app
backgrounded) via an Android foreground service, draws live on the map, and — the
central guarantee — **there is no way to lose an in-progress or just-finished
activity**: it survives the app being closed or killed at any point, in either the
recording phase or the awaiting-save phase.

This is **slice 2** of the activity-recording feature (umbrella:
`2026-08-21-onfoot-rn-activity-recording-slices.md`). It builds on slice 1
(restore-last-map-state): the displayed trail already persists across a restart, so a
recording *and* its overlaid trail both come back together.

## Scope

- **In:** the play → hold-to-stop button (bottom-left of the map); background GPS
  capture via `expo-location` + `TaskManager` + an Android foreground service;
  durable point-by-point persistence; a live growing track overlay; resume-after-kill
  (both recording and awaiting-save phases); the save page (name / effort / comments)
  with Save and Discard; a new `activities` table + a `recording_sessions` +
  `recording_points` table; linking the activity to the displayed trail; the
  clean-prebuild config (background permission, foreground service).
- **Out (slice 3):** the Activities tab list, activity detail/track rendering, and the
  "View linked trail" navigation. This slice writes the data and can render the *live*
  track, but does not build the browse/replay UI.
- **Accepted non-goal:** persisting a *half-typed* name/comment across an app death on
  the save page. The recorded track, metrics, and trail link are all durable; at worst
  the user re-types the name. The activity itself is never lost.

## Locked decisions

From the umbrella brainstorm and this slice's Q&A:

- **Recording = background tracking** via `expo-location`
  `startLocationUpdatesAsync` + a top-level `TaskManager` task + an Android
  **foreground service** (persistent notification) + `ACCESS_BACKGROUND_LOCATION`.
  Requires a clean prebuild and a runtime "Allow all the time" permission prompt.
- **Effort = categorical**: `'easy' | 'moderate' | 'hard' | 'max'` (mirrors the trail
  difficulty vocabulary for a consistent feel), stored as a text column.
- **Live track drawn** on the map as a growing polyline while recording, in a distinct
  theme colour from displayed trails.
- **Link = the trail displayed at stop.** `linkedTrailId` = `selectedTrailId` captured
  when the user holds-to-stop, written onto the session row (`null` if none shown).
- **Discard allowed** on the save page (with confirm), beside Save.
- **The durable truth for "an unfinished activity exists" is a `recording_sessions`
  row.** It is created on start and deleted only on Save or Discard. Its `endedAt`
  distinguishes the recording phase (`null`) from the awaiting-save phase (set).

## Architecture

Three concerns, each its own module boundary:

1. **Persistence** (`src/data/db/*` + `src/data/activities/`) — the tables, the domain
   types, the repository port, and pure mappers. Only `src/data/db/*` imports
   drizzle/expo-sqlite (existing seam).
2. **Recording** (`src/recording/`) — the location-capture seam. The **only** place
   that imports `expo-location` for capture and `expo-task-manager`. Owns the
   background task, the start/stop/resume controller, permission handling, and a
   session-only UI store.
3. **UI** — the bottom-left record button + live overlay (in `src/map/`), the save page
   (`app/activity/save.tsx`) and its presentational `ActivityForm` (`src/activities/`),
   and the launch-resume hook mounted in `app/_layout.tsx`.

> **Seam note.** The map-provider port is about the map *render* SDK (`@rnmapbox/maps`);
> `expo-location` is a device capability, already imported directly under `src/map/`
> (`useLocationPermission`). Slice 2 concentrates all *capture* SDK use in
> `src/recording/` — that module is the location-capture seam. The live overlay renders
> through a new minimal map-provider `RouteLine` port component (a plain polyline),
> implemented only in the mapbox adapter — no SDK use in shared UI. (`TrailOverlay`
> requires arrow/endpoint props, so a dedicated line component is cleaner; slice 3's
> activity-track rendering reuses `RouteLine` too.)

### 1. Data layer

**Migration `0002`** adds three tables to `src/data/db/schema.ts`:

```ts
export const activities = sqliteTable('activities', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  effort: text('effort').notNull(),                 // 'easy' | 'moderate' | 'hard' | 'max'
  comments: text('comments'),                        // nullable
  linkedTrailId: integer('linked_trail_id'),         // nullable, references trails.id
  geometry: text('geometry').notNull(),              // JSON: { points: TrackPoint[] }
  distanceMeters: real('distance_meters').notNull(),
  durationSeconds: integer('duration_seconds').notNull(),
  elevationGainMeters: real('elevation_gain_meters'),// nullable (GPS ele often absent/noisy)
  elevationLossMeters: real('elevation_loss_meters'),// nullable
  startedAt: integer('started_at').notNull(),
  endedAt: integer('ended_at').notNull(),
  createdAt: integer('created_at').notNull(),
})

export const recordingSessions = sqliteTable('recording_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  startedAt: integer('started_at').notNull(),
  endedAt: integer('ended_at'),                      // null = recording; set = stopped/awaiting-save
  linkedTrailId: integer('linked_trail_id'),         // nullable, captured at stop
})

export const recordingPoints = sqliteTable('recording_points', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: integer('session_id').notNull(),
  lat: real('lat').notNull(),
  lng: real('lng').notNull(),
  ele: real('ele'),                                  // nullable
  t: integer('t').notNull(),                         // capture timestamp (ms)
})
```

Generated via `npx drizzle-kit generate` (as with `0001`). At most one session row is
ever active at a time; the design enforces "start only when none active."

**Domain types** in `src/data/activities/types.ts`:

```ts
export type Effort = 'easy' | 'moderate' | 'hard' | 'max'
export interface TrackPoint { lat: number; lng: number; ele: number | null; t: number }
export interface ActivityGeometry { points: TrackPoint[] }
export interface ActivityMetrics {
  distanceMeters: number; durationSeconds: number
  elevationGainMeters: number | null; elevationLossMeters: number | null
}
export interface NewActivityInput {
  name: string; effort: Effort; comments: string | null
  linkedTrailId: number | null
  geometry: ActivityGeometry; metrics: ActivityMetrics
  startedAt: number; endedAt: number
}
export interface ActivitySummary {
  id: number; name: string; effort: Effort
  metrics: ActivityMetrics; linkedTrailId: number | null
  startedAt: number; createdAt: number
}
export interface Activity extends ActivitySummary {
  comments: string | null; geometry: ActivityGeometry; endedAt: number
}
export interface RecordingSession {
  id: number; startedAt: number; endedAt: number | null; linkedTrailId: number | null
}
```

`TrackPoint` is a superset of `GpxPoint` (`{lat,lng,ele}` + `t`), so the existing pure
geo helpers (`boundsForPoints`, `toLineCoordinates`, `endpointCoordinates`) and
`computeMetrics` (Haversine, in `src/data/trails/gpx/metrics.ts`) apply directly to
activity tracks — the extra `t` field is ignored by them.

**Repository port** `src/data/activities/repository.ts` (covers both the recording
lifecycle and activity browse, so it follows the `TrailsRepository` naming):

```ts
export interface ActivitiesRepository {
  // recording lifecycle
  startSession(startedAt: number): Promise<number>          // creates row, returns id
  getActiveSession(): Promise<RecordingSession | null>      // the one row, if any
  appendPoints(sessionId: number, points: TrackPoint[]): Promise<void>  // batch insert
  getSessionPoints(sessionId: number): Promise<TrackPoint[]>            // ordered by t
  markStopped(sessionId: number, endedAt: number, linkedTrailId: number | null): Promise<void>
  discardSession(sessionId: number): Promise<void>          // deletes session + its points
  saveActivity(sessionId: number, input: NewActivityInput): Promise<number>  // insert activity + delete session/points (one tx)
  // activities (browse — mostly slice 3)
  listSummaries(): Promise<ActivitySummary[]>
  getActivity(id: number): Promise<Activity | null>
}
```

Exposed as a singleton `activitiesRepository` from `src/data/activities/index.ts`
(mirrors `trailsRepository`). Implemented by `sqliteActivitiesRepository` in
`src/data/db/activitiesRepository.ts` (the only new DB file). `saveActivity` runs the
insert-activity + delete-session + delete-points in a single transaction, so a crash
mid-save can never leave a half-written activity *and* a leftover session.

**Pure mappers** (`src/data/activities/mapping.ts`, TDD'd): `rowToTrackPoint`,
`rowToSession`, `rowToActivity`/`rowToSummary`, `inputToActivityValues(input, now)`,
`pointsToInsertValues(sessionId, points)`, and
`buildNewActivityInput(session, points, form)` — the pure function that assembles a
`NewActivityInput` from a stopped session, its points, and the form fields (computing
metrics via `computeMetrics` + duration from `endedAt − startedAt`).

### 2. Recording domain (`src/recording/`)

**`locationTask.ts`** — defines the background task at module top level (required by
`expo-location`; the module is imported once for its side effect from
`app/_layout.tsx`):

```ts
export const RECORDING_TASK = 'onfoot-location-recording'

TaskManager.defineTask(RECORDING_TASK, async ({ data, error }) => {
  if (error || !data) return
  const { locations } = data as { locations: Location.LocationObject[] }
  const session = await activitiesRepository.getActiveSession()
  if (!session || session.endedAt != null) return       // stopped/absent → ignore stray fixes
  const points = locations.map(toTrackPoint)             // pure: coords+timestamp → TrackPoint
  await activitiesRepository.appendPoints(session.id, points)
  recordingStore.getState().appendLivePoints(points)     // no-op-cheap if UI unmounted
})
```

The callback does the **least work possible**: map fixes → batch-insert → light store
append. No metric recomputation while recording (metrics are computed once, at save).
`toTrackPoint` is a pure, TDD'd mapper from `Location.LocationObject`
(`{ coords:{latitude,longitude,altitude}, timestamp }`) to `TrackPoint`.

**`recordingController.ts`** — the imperative controls (thin; no React):

- `startRecording(): Promise<StartResult>` — ensure foreground permission, then
  `requestBackgroundPermissionsAsync()`; if background denied, return a
  `'permission-denied'` result (caller explains "recording needs *Allow all the time*"
  and aborts). Else `startSession(now)`, seed the store, and
  `startLocationUpdatesAsync(RECORDING_TASK, RECORDING_OPTIONS)`.
- `stopRecording(linkedTrailId): Promise<void>` — `stopLocationUpdatesAsync`,
  `markStopped(id, now, linkedTrailId)`. The session row survives (awaiting save).
- `resumeIfActive(): Promise<ResumeAction>` — the launch decision (see §3).
- `discardRecording(sessionId): Promise<void>` — ensure updates stopped, then
  `discardSession`.

`RECORDING_OPTIONS` (single constants source, tuned on-device):

```ts
{
  accuracy: Location.Accuracy.High,
  distanceInterval: 10,                 // meters — cap capture rate; skip redundant points
  deferredUpdatesInterval: 15000,       // ms — batch delivery: far fewer wakeups
  deferredUpdatesDistance: 50,          // meters
  pausesUpdatesAutomatically: false,    // never silently stop mid-hike
  activityType: Location.ActivityType.Fitness,
  foregroundService: {
    notificationTitle: 'On Foot',
    notificationBody: 'Recording your activity',
    notificationColor: <theme accent>,
  },
}
```

**`recordingStore.ts`** — Zustand, **session-only, NOT persisted** (SQLite is the
durable truth). Holds `phase: 'idle' | 'recording' | 'saving'`, `sessionId`,
`startedAt`, `liveGeometry: ActivityGeometry` (drives the overlay), and actions
`hydrateFrom(session, points)`, `appendLivePoints(points)`, `beginSaving()`, `reset()`.
The pure state transitions are TDD'd.

### 3. Launch routing (pure state machine)

`resumeIfActive()` reads the active session and returns one of three actions; the
routing is a **pure function** `resumeActionFor(session)` (TDD'd), the controller then
performs the side effects:

| Session state              | Action           | Effect                                                                 |
|----------------------------|------------------|-----------------------------------------------------------------------|
| none                       | `'none'`         | normal launch                                                          |
| `endedAt == null`          | `'resume'`       | hydrate store+overlay from stored points; restart `startLocationUpdatesAsync` if not already running (`hasStartedLocationUpdatesAsync`); **append `getCurrentPositionAsync` now** so the overlay draws a straight line from the last stored point to the current position across the dead gap; show the **stop** button |
| `endedAt` set              | `'save'`         | do **not** restart tracking; navigate to `/activity/save` — it loads the pending session's points/metrics/`linkedTrailId` |

Mounted via a `useResumeRecording()` hook in `app/_layout.tsx`, gated on migrations
success and navigation readiness (same gating pattern as `useIncomingShare`).

### 4. Map UI

- **`RecordButton`** (`src/map/RecordButton.tsx`) — anchored **bottom-left**, mirroring
  `MapControls`' safe-area insets on the opposite side. `phase === 'recording'` shows a
  **stop** ■ that requires a **press-and-hold (~1 s, with a circular fill progress
  ring)** to stop; otherwise a **play** ▶ that starts on tap. Hold uses a
  `Gesture.LongPress` (RNGH, consistent with existing gesture usage); the ring animates
  the hold. Hold duration + ring live in `MapTokens`. On successful hold → call
  `stopRecording(selectedTrailId)` then `router.push('/activity/save')`.
- **Live overlay** — `MapCanvas` renders `recordingStore.liveGeometry` (when
  `phase === 'recording'`) through a new minimal `RouteLine` map-port component (plain
  polyline: `line`, `color`, `lineWidth`) in a distinct theme colour (`recordingLine`).
  Because delivery is batched (~15 s), overlay re-renders are infrequent. No
  endpoints/arrows on the live track — just the line.

### 5. Save page + `ActivityForm`

- **`app/activity/save.tsx`** — mirrors `app/trail/new.tsx`: on mount, load the active
  (stopped) session + its points; if none, `router.replace('/')` (defensive). Compute
  metrics from the points. Render `ActivityForm`. On **Save**:
  `buildNewActivityInput(session, points, form)` → `activitiesStore.saveActivity(input)`
  (which writes the activity and deletes the session/points in one tx) → `reset()` the
  recording store → `router.replace('/')`. On **Discard** (confirm via `Alert`):
  `discardRecording(session.id)` → `reset()` → `router.replace('/')`.
- **`ActivityForm`** (`src/activities/ActivityForm.tsx`) — presentational, mirroring
  `TrailForm`'s shape: read-only metrics summary (distance • duration • elevation),
  a **name** input, an **effort** picker (Easy / Moderate / Hard / Max segmented
  control, mirroring the difficulty picker), a **comments** multiline input, and
  **Save** + **Discard** actions. Props:
  `metrics`, `initialName`, `initialEffort`, `initialComments`, `onSave`, `onDiscard`.
- **`activitiesStore.ts`** (`src/store/`) — Zustand, mirrors `trailsStore`:
  `saveActivity(input)` (repo call), and `activities`/`loadActivities` scaffolding used
  in full by slice 3.

### 6. Config — clean prebuild

`app.config.ts`:

- `expo-location` plugin gains options:
  ```ts
  ["expo-location", {
    isAndroidBackgroundLocationEnabled: true,
    isAndroidForegroundServiceEnabled: true,
    locationAlwaysAndWhenInUsePermission: "Allow On Foot to record your activity while the app is in the background.",
  }]
  ```
  This adds `ACCESS_BACKGROUND_LOCATION` + the foreground-service permissions.
- Add the `expo-task-manager` dependency (`npx expo install expo-task-manager`) — it is
  autolinked, so no `plugins` entry is needed.
- Requires `npx expo prebuild --clean` (the `/android` dir already exists;
  permission/manifest changes only merge on a clean prebuild — a hard-won lesson from
  the intent-filter work) and a fresh native build.

## Recording lifecycle & durability

```
IDLE
  └─ tap play → startRecording()
        permission denied → explain + stay IDLE
        granted → startSession(now) [DB row, endedAt=null] + startLocationUpdatesAsync
              → RECORDING

RECORDING  (background task appends points to DB every ~15s; store overlay grows)
  ├─ app closed/swiped, service alive → points keep logging; no gap
  ├─ process killed (battery/force-stop) → gap; session row persists (endedAt=null)
  │      └─ relaunch → resumeActionFor = 'resume' → restart updates + getCurrentPositionAsync
  │             → overlay draws straight line last-point → now → RECORDING
  └─ hold-to-stop → stopRecording(selectedTrailId)
        [stopLocationUpdatesAsync + markStopped(now, linkedTrailId); row survives]
        → router.push('/activity/save') → SAVING

SAVING  (session row persists, endedAt set)
  ├─ app killed on the save page → session row persists (endedAt set)
  │      └─ relaunch → resumeActionFor = 'save' → open /activity/save with pending session
  ├─ Save → saveActivity(input) [insert activity + delete session/points, one tx] → IDLE
  └─ Discard (confirm) → discardSession → IDLE
```

**Durability matrix — the "no way to lose it" guarantee:**

| Moment of close/kill        | On relaunch                                             |
|-----------------------------|--------------------------------------------------------|
| mid-recording, service alive| resumes recording, full track intact                   |
| mid-recording, process dead | resumes recording; straight line bridges the dead gap  |
| just after stop, before save| reopens the save page with the pending activity        |
| on the save page            | reopens the save page with the pending activity        |
| during Save's transaction   | either fully saved (row exists) or still pending (retry)|

The invariant: **an unfinished activity is exactly a `recording_sessions` row.** No
window exists where the track lives only in memory — every fix batch is in SQLite before
the callback returns, and the session row is deleted only by Save or Discard.

## Battery

- **Batched delivery** (`deferredUpdatesInterval`/`deferredUpdatesDistance`) so Android
  wakes the process in groups, not per fix — the dominant battery lever.
- **Capped capture rate** (`distanceInterval: 10`) so a stationary user logs nothing.
- **Minimal per-callback work**: batch insert + light overlay append; no metric
  recompute while recording.
- `pausesUpdatesAutomatically: false` so it never silently stops mid-hike.
- Exact accuracy/interval values are tuned on-device (fidelity vs. drain) but live in
  one `RECORDING_OPTIONS` constant.

## Error handling

- **Background permission denied** → explain that recording needs "Allow all the time";
  stay idle. (No foreground-only fallback — background capture is the whole point.)
- **Start attempted while a session is active** → the controller refuses to start a
  second session (single-active-session invariant).
- **Save page with no active session** (stale nav) → `router.replace('/')`.
- **Stray fixes after stop** → the task callback ignores fixes when the session is
  absent or already stopped.
- **Corrupt/partial save** → prevented by the single-transaction `saveActivity`.

## Testing

**Pure logic (Jest, TDD) — new/extended `__tests__`:**
- `toTrackPoint` maps a `LocationObject` (incl. null altitude → `ele: null`).
- Mappers: `rowToTrackPoint`, `rowToSession`, `rowToActivity`/`rowToSummary`,
  `inputToActivityValues`, `pointsToInsertValues`.
- `buildNewActivityInput(session, points, form)`: correct metrics (distance via
  Haversine, `durationSeconds = endedAt − startedAt`, elevation null when no `ele`),
  geometry, and passthrough of name/effort/comments/linkedTrailId.
- `resumeActionFor(session)`: `null → 'none'`, `endedAt null → 'resume'`,
  `endedAt set → 'save'`.
- `recordingStore` transitions: `hydrateFrom`, `appendLivePoints` (order/append),
  `beginSaving`, `reset`.
- Effort value validation.

**Device-verified (native, not unit-tested):**
- Play starts capture; foreground-service notification appears; live line grows as you
  walk; hold-to-stop (ring fills) → save page.
- Screen off / app backgrounded → capture continues (line present on return).
- **Kill mid-recording (force-stop) → reopen → recording resumes, straight line bridges
  the gap.**
- **Kill on the save page → reopen → save page returns with the pending activity.**
- Save writes the activity (verify row + metrics); Discard drops it (no row, no leftover
  session).
- Recording while a trail is displayed → saved activity has `linkedTrailId` = that
  trail; recording with no trail → `linkedTrailId` null.
- Background permission denied → clear explanation, no recording.
