# Record & Save an Activity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record the user's live GPS trail in the background, draw it live, and save it as a named/rated activity — with the recording (and the just-finished, awaiting-save activity) surviving an app close or kill at any point.

**Architecture:** A durable `recording_sessions` row (plus append-only `recording_points`) is the single source of truth for "an unfinished activity exists"; a top-level `TaskManager` task fed by `expo-location` background updates appends points to SQLite per batch and to a session-only store for the live overlay. Launch inspects the session and either resumes tracking, reopens the save page, or starts clean. Data goes through the persistence seam (`src/data/db/*` + `src/data/activities/`); location capture is concentrated in `src/recording/`; the live line renders through a new `RouteLine` map-provider port component.

**Tech Stack:** Expo SDK 57, React Native, TypeScript, expo-location + expo-task-manager (background location + Android foreground service), expo-sqlite + drizzle-orm + drizzle-kit, Zustand, expo-router, react-native-gesture-handler + react-native-reanimated + react-native-svg (hold-to-stop ring), @rnmapbox/maps (behind the provider seam).

## Global Constraints

Design of record: `docs/superpowers/specs/2026-08-22-onfoot-rn-record-activity-design.md`. Read it if any task is ambiguous.

- **The durable invariant:** an unfinished activity is *exactly* a `recording_sessions` row. It is created on start and deleted only by Save or Discard. `endedAt == null` ⇒ recording; `endedAt` set ⇒ stopped/awaiting-save. There must be no window where the track lives only in memory.
- **Persistence seam:** only `src/data/db/*` imports `expo-sqlite`/`drizzle-orm`. UI/store use the `ActivitiesRepository` port from `src/data/activities/`. Mirror the existing `trails` domain exactly.
- **Location-capture seam:** only `src/recording/*` imports `expo-location` (for capture) and `expo-task-manager`. UI reads recording state from the recording store and calls the controller.
- **Map-provider seam:** only `src/map/providers/mapbox/` imports `@rnmapbox/maps`. New overlay concepts are declared on the port (`src/map/provider/types.ts`) — never leaked into shared UI.
- **Effort vocabulary:** `'easy' | 'moderate' | 'hard' | 'max'` (text column). No new theme colours for effort — reuse `difficultyEasy/Medium/Hard` + `danger`.
- **Persist the minimum:** the recording store is session-only (NOT persisted) — SQLite is the durable truth.
- **Pure logic is TDD'd; native rendering/gestures/location are device-verified.** Pure = mappers, metrics assembly, store transitions, `resumeActionFor`, formatters.
- **Comments describe current state only** — no change-narration (AGENTS.md).
- **Battery:** background work stays minimal — batched deferred delivery, `distanceInterval` cap, least work per callback, no metric recompute while recording. All capture tuning lives in one `RECORDING_OPTIONS` constant.
- **Verification gate per task:** `npx tsc --noEmit` clean and `npx jest` green. Native tasks additionally note what the user must device-verify (they cannot be unit-tested).
- **Typed-routes note:** `experiments.typedRoutes` is on and `.expo/types` is gitignored. A fresh worktree has no generated route types, so route strings are permissive there; the main worktree may hold stale strict types. Tasks are ordered so the `/activity/save` route file exists before any task references it; if `tsc` ever flags `/activity/save` in a worktree that *does* have `.expo/types`, run `npx expo export` to regenerate them.

---

### Task 1: DB schema + migration 0002

**Files:**
- Modify: `src/data/db/schema.ts`
- Create (generated): `src/data/db/migrations/0002_*.sql`, updated `src/data/db/migrations/meta/*`, `src/data/db/migrations/migrations.js`

**Interfaces:**
- Produces: drizzle tables `activities`, `recordingSessions`, `recordingPoints` (consumed by Task 3).

- [ ] **Step 1: Add the three tables to the schema**

Append to `src/data/db/schema.ts` (keep the existing `trails` table unchanged; `integer`, `real`, `text`, `sqliteTable` are already imported):

```ts
export const activities = sqliteTable('activities', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  effort: text('effort').notNull(),
  comments: text('comments'),
  linkedTrailId: integer('linked_trail_id'),
  geometry: text('geometry').notNull(),
  distanceMeters: real('distance_meters').notNull(),
  durationSeconds: integer('duration_seconds').notNull(),
  elevationGainMeters: real('elevation_gain_meters'),
  elevationLossMeters: real('elevation_loss_meters'),
  startedAt: integer('started_at').notNull(),
  endedAt: integer('ended_at').notNull(),
  createdAt: integer('created_at').notNull(),
})

export const recordingSessions = sqliteTable('recording_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  startedAt: integer('started_at').notNull(),
  endedAt: integer('ended_at'),
  linkedTrailId: integer('linked_trail_id'),
})

export const recordingPoints = sqliteTable('recording_points', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: integer('session_id').notNull(),
  lat: real('lat').notNull(),
  lng: real('lng').notNull(),
  ele: real('ele'),
  t: integer('t').notNull(),
})
```

- [ ] **Step 2: Generate the migration**

Run: `npx drizzle-kit generate`
Expected: a new `0002_*.sql` creating the three tables, a new `meta/0002_snapshot.json`, an added entry in `meta/_journal.json`, and a regenerated `migrations.js`. Confirm the SQL contains `CREATE TABLE \`activities\``, `\`recording_sessions\``, `\`recording_points\`` and does NOT alter or drop `trails`.

- [ ] **Step 3: Verify the bundle transforms the new migration**

Run: `npx tsc --noEmit` (clean) and `npx jest` (existing suite still green).
Note: the `.sql` is inline-imported at build time (Metro + `babel-plugin-inline-import` are already configured from the trails work), so no Metro config change is needed.

- [ ] **Step 4: Commit**

```bash
git add src/data/db/schema.ts src/data/db/migrations
git commit -m "feat: add activities, recording_sessions, recording_points tables (migration 0002)"
```

---

### Task 2: Activities domain types + pure mappers (TDD)

**Files:**
- Create: `src/data/activities/types.ts`
- Create: `src/data/activities/mapping.ts`
- Test: `src/data/activities/__tests__/mapping.test.ts`

**Interfaces:**
- Consumes: `computeMetrics` from `src/data/trails/gpx/metrics.ts`; `GpxPoint` from `src/data/trails/types.ts`.
- Produces: the activity domain types + mapping/assembly functions used by Task 3 (repository), Task 4 (store/logic), Task 7 (save page).

- [ ] **Step 1: Write the domain types**

Create `src/data/activities/types.ts`:

```ts
export type Effort = 'easy' | 'moderate' | 'hard' | 'max'

export interface TrackPoint { lat: number; lng: number; ele: number | null; t: number }
export interface ActivityGeometry { points: TrackPoint[] }

export interface ActivityMetrics {
  distanceMeters: number
  durationSeconds: number
  elevationGainMeters: number | null
  elevationLossMeters: number | null
}

export interface NewActivityInput {
  name: string
  effort: Effort
  comments: string | null
  linkedTrailId: number | null
  geometry: ActivityGeometry
  metrics: ActivityMetrics
  startedAt: number
  endedAt: number
}

export interface ActivitySummary {
  id: number
  name: string
  effort: Effort
  metrics: ActivityMetrics
  linkedTrailId: number | null
  startedAt: number
  createdAt: number
}

export interface Activity extends ActivitySummary {
  comments: string | null
  geometry: ActivityGeometry
  endedAt: number
}

export interface RecordingSession {
  id: number
  startedAt: number
  endedAt: number | null
  linkedTrailId: number | null
}
```

- [ ] **Step 2: Write the failing mapper tests**

Create `src/data/activities/__tests__/mapping.test.ts`:

```ts
import {
  activityMetricsFromPoints, buildNewActivityInput, deserializeActivityGeometry,
  inputToActivityValues, pointsToInsertValues, rowToActivity, rowToSession,
  rowToSummary, rowToTrackPoint, serializeActivityGeometry,
} from '../mapping'
import { NewActivityInput, TrackPoint } from '../types'

const pts: TrackPoint[] = [
  { lat: 0, lng: 0, ele: 100, t: 1000 },
  { lat: 0, lng: 0.001, ele: 110, t: 4000 },
  { lat: 0, lng: 0.002, ele: 105, t: 7000 },
]

describe('activity geometry (de)serialize', () => {
  it('round-trips points', () => {
    expect(deserializeActivityGeometry(serializeActivityGeometry({ points: pts }))).toEqual({ points: pts })
  })
  it('defaults missing points to []', () => {
    expect(deserializeActivityGeometry('{}')).toEqual({ points: [] })
  })
})

describe('rowToTrackPoint', () => {
  it('maps a point row incl. null ele', () => {
    expect(rowToTrackPoint({ id: 1, sessionId: 2, lat: 1, lng: 2, ele: null, t: 5 }))
      .toEqual({ lat: 1, lng: 2, ele: null, t: 5 })
  })
})

describe('rowToSession', () => {
  it('maps a session row (recording)', () => {
    expect(rowToSession({ id: 3, startedAt: 10, endedAt: null, linkedTrailId: null }))
      .toEqual({ id: 3, startedAt: 10, endedAt: null, linkedTrailId: null })
  })
})

describe('activityMetricsFromPoints', () => {
  it('computes distance, duration, elevation', () => {
    const m = activityMetricsFromPoints(pts, 1000, 7000)
    expect(m.distanceMeters).toBeGreaterThan(0)
    expect(m.durationSeconds).toBe(6)
    expect(m.elevationGainMeters).toBe(10)
    expect(m.elevationLossMeters).toBe(5)
  })
  it('returns null elevation when no point has ele', () => {
    const flat: TrackPoint[] = [{ lat: 0, lng: 0, ele: null, t: 0 }, { lat: 0, lng: 0.001, ele: null, t: 2000 }]
    const m = activityMetricsFromPoints(flat, 0, 2000)
    expect(m.elevationGainMeters).toBeNull()
    expect(m.elevationLossMeters).toBeNull()
  })
  it('never returns a negative duration', () => {
    expect(activityMetricsFromPoints(pts, 7000, 1000).durationSeconds).toBe(0)
  })
})

describe('buildNewActivityInput', () => {
  const session = { id: 9, startedAt: 1000, endedAt: 7000, linkedTrailId: 42 }
  const form = { name: 'Morning walk', effort: 'moderate' as const, comments: 'nice' }
  it('assembles the input from session + points + form', () => {
    const input = buildNewActivityInput(session, pts, form)
    expect(input).toMatchObject({
      name: 'Morning walk', effort: 'moderate', comments: 'nice',
      linkedTrailId: 42, startedAt: 1000, endedAt: 7000,
      geometry: { points: pts },
    })
    expect(input.metrics.durationSeconds).toBe(6)
  })
  it('falls back to the last point time when endedAt is null', () => {
    const input = buildNewActivityInput({ ...session, endedAt: null }, pts, form)
    expect(input.endedAt).toBe(7000)
  })
})

describe('inputToActivityValues / pointsToInsertValues', () => {
  const input: NewActivityInput = {
    name: 'A', effort: 'hard', comments: null, linkedTrailId: null,
    geometry: { points: pts },
    metrics: { distanceMeters: 12, durationSeconds: 6, elevationGainMeters: 10, elevationLossMeters: 5 },
    startedAt: 1000, endedAt: 7000,
  }
  it('flattens input to insert values with createdAt', () => {
    const v = inputToActivityValues(input, 9999)
    expect(v).toMatchObject({
      name: 'A', effort: 'hard', comments: null, linkedTrailId: null,
      distanceMeters: 12, durationSeconds: 6, elevationGainMeters: 10, elevationLossMeters: 5,
      startedAt: 1000, endedAt: 7000, createdAt: 9999,
    })
    expect(JSON.parse(v.geometry)).toEqual({ points: pts })
  })
  it('maps points to per-row insert values', () => {
    expect(pointsToInsertValues(7, [pts[0]])).toEqual([{ sessionId: 7, lat: 0, lng: 0, ele: 100, t: 1000 }])
  })
})

describe('rowToSummary / rowToActivity', () => {
  const row = {
    id: 1, name: 'A', effort: 'max', comments: 'c', linkedTrailId: 3,
    geometry: JSON.stringify({ points: pts }),
    distanceMeters: 12, durationSeconds: 6, elevationGainMeters: 10, elevationLossMeters: 5,
    startedAt: 1000, endedAt: 7000, createdAt: 9999,
  }
  it('summary carries metrics + link, no geometry', () => {
    expect(rowToSummary(row)).toEqual({
      id: 1, name: 'A', effort: 'max',
      metrics: { distanceMeters: 12, durationSeconds: 6, elevationGainMeters: 10, elevationLossMeters: 5 },
      linkedTrailId: 3, startedAt: 1000, createdAt: 9999,
    })
  })
  it('activity adds comments, geometry, endedAt', () => {
    const a = rowToActivity(row)
    expect(a.geometry).toEqual({ points: pts })
    expect(a.comments).toBe('c')
    expect(a.endedAt).toBe(7000)
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx jest src/data/activities/__tests__/mapping.test.ts`
Expected: FAIL (module `../mapping` not found).

- [ ] **Step 4: Implement the mappers**

Create `src/data/activities/mapping.ts`:

```ts
import { computeMetrics } from '../trails/gpx/metrics'
import {
  Activity, ActivityGeometry, ActivityMetrics, ActivitySummary,
  Effort, NewActivityInput, RecordingSession, TrackPoint,
} from './types'

export interface ActivityRow {
  id: number
  name: string
  effort: string
  comments: string | null
  linkedTrailId: number | null
  geometry: string
  distanceMeters: number
  durationSeconds: number
  elevationGainMeters: number | null
  elevationLossMeters: number | null
  startedAt: number
  endedAt: number
  createdAt: number
}

export interface ActivityInsertValues {
  name: string
  effort: string
  comments: string | null
  linkedTrailId: number | null
  geometry: string
  distanceMeters: number
  durationSeconds: number
  elevationGainMeters: number | null
  elevationLossMeters: number | null
  startedAt: number
  endedAt: number
  createdAt: number
}

export interface RecordingSessionRow {
  id: number
  startedAt: number
  endedAt: number | null
  linkedTrailId: number | null
}

export interface RecordingPointRow {
  id: number
  sessionId: number
  lat: number
  lng: number
  ele: number | null
  t: number
}

export interface RecordingPointInsertValues {
  sessionId: number
  lat: number
  lng: number
  ele: number | null
  t: number
}

export interface ActivityFormFields {
  name: string
  effort: Effort
  comments: string | null
}

export function serializeActivityGeometry(geometry: ActivityGeometry): string {
  return JSON.stringify(geometry)
}

export function deserializeActivityGeometry(json: string): ActivityGeometry {
  const parsed = JSON.parse(json) as Partial<ActivityGeometry>
  return { points: parsed.points ?? [] }
}

export function rowToTrackPoint(row: RecordingPointRow): TrackPoint {
  return { lat: row.lat, lng: row.lng, ele: row.ele, t: row.t }
}

export function rowToSession(row: RecordingSessionRow): RecordingSession {
  return { id: row.id, startedAt: row.startedAt, endedAt: row.endedAt, linkedTrailId: row.linkedTrailId }
}

export function rowToSummary(row: ActivityRow): ActivitySummary {
  return {
    id: row.id,
    name: row.name,
    effort: row.effort as Effort,
    metrics: {
      distanceMeters: row.distanceMeters,
      durationSeconds: row.durationSeconds,
      elevationGainMeters: row.elevationGainMeters,
      elevationLossMeters: row.elevationLossMeters,
    },
    linkedTrailId: row.linkedTrailId,
    startedAt: row.startedAt,
    createdAt: row.createdAt,
  }
}

export function rowToActivity(row: ActivityRow): Activity {
  return {
    ...rowToSummary(row),
    comments: row.comments,
    geometry: deserializeActivityGeometry(row.geometry),
    endedAt: row.endedAt,
  }
}

export function activityMetricsFromPoints(
  points: TrackPoint[],
  startedAt: number,
  endedAt: number,
): ActivityMetrics {
  const m = computeMetrics(points)
  return {
    distanceMeters: m.distanceMeters,
    durationSeconds: Math.max(0, Math.round((endedAt - startedAt) / 1000)),
    elevationGainMeters: m.elevationGainMeters,
    elevationLossMeters: m.elevationLossMeters,
  }
}

export function buildNewActivityInput(
  session: RecordingSession,
  points: TrackPoint[],
  form: ActivityFormFields,
): NewActivityInput {
  const endedAt = session.endedAt ?? points[points.length - 1]?.t ?? session.startedAt
  return {
    name: form.name,
    effort: form.effort,
    comments: form.comments,
    linkedTrailId: session.linkedTrailId,
    geometry: { points },
    metrics: activityMetricsFromPoints(points, session.startedAt, endedAt),
    startedAt: session.startedAt,
    endedAt,
  }
}

export function inputToActivityValues(input: NewActivityInput, now: number): ActivityInsertValues {
  return {
    name: input.name,
    effort: input.effort,
    comments: input.comments,
    linkedTrailId: input.linkedTrailId,
    geometry: serializeActivityGeometry(input.geometry),
    distanceMeters: input.metrics.distanceMeters,
    durationSeconds: input.metrics.durationSeconds,
    elevationGainMeters: input.metrics.elevationGainMeters,
    elevationLossMeters: input.metrics.elevationLossMeters,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    createdAt: now,
  }
}

export function pointsToInsertValues(sessionId: number, points: TrackPoint[]): RecordingPointInsertValues[] {
  return points.map((p) => ({ sessionId, lat: p.lat, lng: p.lng, ele: p.ele, t: p.t }))
}
```

Note: `computeMetrics(points)` accepts `TrackPoint[]` — `TrackPoint` is a structural superset of `GpxPoint` (`{lat,lng,ele}`), so it is assignable with no cast; the extra `t` is ignored.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest src/data/activities/__tests__/mapping.test.ts` → PASS. Then `npx tsc --noEmit` → clean.

- [ ] **Step 6: Commit**

```bash
git add src/data/activities/types.ts src/data/activities/mapping.ts src/data/activities/__tests__/mapping.test.ts
git commit -m "feat: activity domain types + pure mappers (TDD)"
```

---

### Task 3: Activities repository (port + SQLite impl)

**Files:**
- Create: `src/data/activities/repository.ts`
- Create: `src/data/activities/index.ts`
- Create: `src/data/db/activitiesRepository.ts`

**Interfaces:**
- Consumes: tables from Task 1; mappers from Task 2.
- Produces: `activitiesRepository` singleton + `ActivitiesRepository` type (consumed by Tasks 5, 7, 9).

- [ ] **Step 1: Define the port**

Create `src/data/activities/repository.ts`:

```ts
import { Activity, ActivitySummary, NewActivityInput, RecordingSession, TrackPoint } from './types'

export interface ActivitiesRepository {
  startSession(startedAt: number): Promise<number>
  getActiveSession(): Promise<RecordingSession | null>
  appendPoints(sessionId: number, points: TrackPoint[]): Promise<void>
  getSessionPoints(sessionId: number): Promise<TrackPoint[]>
  markStopped(sessionId: number, endedAt: number, linkedTrailId: number | null): Promise<void>
  discardSession(sessionId: number): Promise<void>
  saveActivity(sessionId: number, input: NewActivityInput): Promise<number>
  listSummaries(): Promise<ActivitySummary[]>
  getActivity(id: number): Promise<Activity | null>
}
```

- [ ] **Step 2: Wire the barrel**

Create `src/data/activities/index.ts` (mirrors `src/data/trails/index.ts`):

```ts
import { sqliteActivitiesRepository } from '../db/activitiesRepository'
import { ActivitiesRepository } from './repository'

export const activitiesRepository: ActivitiesRepository = sqliteActivitiesRepository

export * from './types'
export * from './repository'
```

- [ ] **Step 3: Implement the SQLite repository**

Create `src/data/db/activitiesRepository.ts`:

```ts
import { asc, desc, eq } from 'drizzle-orm'
import { ActivitiesRepository } from '../activities/repository'
import {
  ActivityRow, RecordingPointRow, RecordingSessionRow,
  inputToActivityValues, pointsToInsertValues,
  rowToActivity, rowToSession, rowToSummary, rowToTrackPoint,
} from '../activities/mapping'
import { db } from './client'
import { activities, recordingPoints, recordingSessions } from './schema'

export const sqliteActivitiesRepository: ActivitiesRepository = {
  async startSession(startedAt) {
    const [inserted] = await db
      .insert(recordingSessions)
      .values({ startedAt })
      .returning({ id: recordingSessions.id })
    return inserted.id
  },
  async getActiveSession() {
    const rows = await db
      .select()
      .from(recordingSessions)
      .orderBy(desc(recordingSessions.id))
      .limit(1)
    return rows.length ? rowToSession(rows[0] as RecordingSessionRow) : null
  },
  async appendPoints(sessionId, points) {
    if (points.length === 0) return
    await db.insert(recordingPoints).values(pointsToInsertValues(sessionId, points))
  },
  async getSessionPoints(sessionId) {
    const rows = await db
      .select()
      .from(recordingPoints)
      .where(eq(recordingPoints.sessionId, sessionId))
      .orderBy(asc(recordingPoints.t), asc(recordingPoints.id))
    return (rows as RecordingPointRow[]).map(rowToTrackPoint)
  },
  async markStopped(sessionId, endedAt, linkedTrailId) {
    await db
      .update(recordingSessions)
      .set({ endedAt, linkedTrailId })
      .where(eq(recordingSessions.id, sessionId))
  },
  async discardSession(sessionId) {
    await db.delete(recordingPoints).where(eq(recordingPoints.sessionId, sessionId))
    await db.delete(recordingSessions).where(eq(recordingSessions.id, sessionId))
  },
  async saveActivity(sessionId, input) {
    return await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(activities)
        .values(inputToActivityValues(input, Date.now()))
        .returning({ id: activities.id })
      await tx.delete(recordingPoints).where(eq(recordingPoints.sessionId, sessionId))
      await tx.delete(recordingSessions).where(eq(recordingSessions.id, sessionId))
      return inserted.id
    })
  },
  async listSummaries() {
    const rows = await db.select().from(activities).orderBy(desc(activities.startedAt))
    return (rows as ActivityRow[]).map(rowToSummary)
  },
  async getActivity(id) {
    const rows = await db.select().from(activities).where(eq(activities.id, id)).limit(1)
    return rows.length ? rowToActivity(rows[0] as ActivityRow) : null
  },
}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` (clean) and `npx jest` (green). The repository is DB-bound (verified on-device in later tasks), mirroring `trailsRepository` which likewise has no unit test — its pure mappers are covered by Task 2.

- [ ] **Step 5: Commit**

```bash
git add src/data/activities/repository.ts src/data/activities/index.ts src/data/db/activitiesRepository.ts
git commit -m "feat: activities repository (port + sqlite impl, atomic saveActivity)"
```

---

### Task 4: Recording pure logic + store (TDD)

**Files:**
- Create: `src/recording/track.ts`
- Create: `src/recording/resume.ts`
- Create: `src/recording/recordingStore.ts`
- Test: `src/recording/__tests__/track.test.ts`
- Test: `src/recording/__tests__/resume.test.ts`
- Test: `src/recording/__tests__/recordingStore.test.ts`

**Interfaces:**
- Consumes: activity domain types from Task 2.
- Produces: `toTrackPoint`, `resumeActionFor`, `ResumeAction`, `useRecordingStore` (consumed by Tasks 5, 8, 9, 10).

- [ ] **Step 1: Write the failing tests**

Create `src/recording/__tests__/track.test.ts`:

```ts
import { toTrackPoint } from '../track'

describe('toTrackPoint', () => {
  it('maps a device location to a track point', () => {
    expect(toTrackPoint({
      coords: { latitude: 1.5, longitude: -2.5, altitude: 120 }, timestamp: 1234.7,
    })).toEqual({ lat: 1.5, lng: -2.5, ele: 120, t: 1235 })
  })
  it('keeps a null altitude as null ele', () => {
    expect(toTrackPoint({
      coords: { latitude: 0, longitude: 0, altitude: null }, timestamp: 5,
    })).toEqual({ lat: 0, lng: 0, ele: null, t: 5 })
  })
})
```

Create `src/recording/__tests__/resume.test.ts`:

```ts
import { resumeActionFor } from '../resume'

describe('resumeActionFor', () => {
  it('no session → none', () => {
    expect(resumeActionFor(null)).toBe('none')
  })
  it('endedAt null → resume', () => {
    expect(resumeActionFor({ id: 1, startedAt: 0, endedAt: null, linkedTrailId: null })).toBe('resume')
  })
  it('endedAt set → save', () => {
    expect(resumeActionFor({ id: 1, startedAt: 0, endedAt: 10, linkedTrailId: 2 })).toBe('save')
  })
})
```

Create `src/recording/__tests__/recordingStore.test.ts`:

```ts
import { useRecordingStore } from '../recordingStore'
import { TrackPoint } from '../../data/activities'

const p = (t: number): TrackPoint => ({ lat: 0, lng: t, ele: null, t })

beforeEach(() => {
  useRecordingStore.setState({ phase: 'idle', sessionId: null, startedAt: null, liveGeometry: { points: [] } })
})

describe('recordingStore', () => {
  it('startRecording sets recording phase + session + empty geometry', () => {
    useRecordingStore.getState().startRecording(7, 1000)
    expect(useRecordingStore.getState()).toMatchObject({ phase: 'recording', sessionId: 7, startedAt: 1000 })
    expect(useRecordingStore.getState().liveGeometry.points).toEqual([])
  })
  it('hydrateFrom loads a session + its points into recording phase', () => {
    useRecordingStore.getState().hydrateFrom({ id: 3, startedAt: 500, endedAt: null, linkedTrailId: null }, [p(1), p(2)])
    expect(useRecordingStore.getState()).toMatchObject({ phase: 'recording', sessionId: 3, startedAt: 500 })
    expect(useRecordingStore.getState().liveGeometry.points).toHaveLength(2)
  })
  it('appendLivePoints appends in order', () => {
    useRecordingStore.getState().startRecording(1, 0)
    useRecordingStore.getState().appendLivePoints([p(1), p(2)])
    useRecordingStore.getState().appendLivePoints([p(3)])
    expect(useRecordingStore.getState().liveGeometry.points.map((x) => x.t)).toEqual([1, 2, 3])
  })
  it('appendLivePoints with [] is a no-op', () => {
    useRecordingStore.getState().startRecording(1, 0)
    const before = useRecordingStore.getState().liveGeometry
    useRecordingStore.getState().appendLivePoints([])
    expect(useRecordingStore.getState().liveGeometry).toBe(before)
  })
  it('beginSaving moves to saving phase', () => {
    useRecordingStore.getState().startRecording(1, 0)
    useRecordingStore.getState().beginSaving()
    expect(useRecordingStore.getState().phase).toBe('saving')
  })
  it('reset returns to idle + clears everything', () => {
    useRecordingStore.getState().startRecording(1, 0)
    useRecordingStore.getState().reset()
    expect(useRecordingStore.getState()).toMatchObject({ phase: 'idle', sessionId: null, startedAt: null })
    expect(useRecordingStore.getState().liveGeometry.points).toEqual([])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/recording` → FAIL (modules not found).

- [ ] **Step 3: Implement the pure track mapper**

Create `src/recording/track.ts`:

```ts
import { TrackPoint } from '../data/activities'

export interface DeviceLocation {
  coords: { latitude: number; longitude: number; altitude: number | null }
  timestamp: number
}

export function toTrackPoint(loc: DeviceLocation): TrackPoint {
  return {
    lat: loc.coords.latitude,
    lng: loc.coords.longitude,
    ele: loc.coords.altitude,
    t: Math.round(loc.timestamp),
  }
}
```

- [ ] **Step 4: Implement the resume decision**

Create `src/recording/resume.ts`:

```ts
import { RecordingSession } from '../data/activities'

export type ResumeAction = 'none' | 'resume' | 'save'

export function resumeActionFor(session: RecordingSession | null): ResumeAction {
  if (!session) return 'none'
  return session.endedAt == null ? 'resume' : 'save'
}
```

- [ ] **Step 5: Implement the store**

Create `src/recording/recordingStore.ts`:

```ts
import { create } from 'zustand'
import { ActivityGeometry, RecordingSession, TrackPoint } from '../data/activities'

export type RecordingPhase = 'idle' | 'recording' | 'saving'

const EMPTY_GEOMETRY: ActivityGeometry = { points: [] }

interface RecordingStore {
  phase: RecordingPhase
  sessionId: number | null
  startedAt: number | null
  liveGeometry: ActivityGeometry
  startRecording: (sessionId: number, startedAt: number) => void
  hydrateFrom: (session: RecordingSession, points: TrackPoint[]) => void
  appendLivePoints: (points: TrackPoint[]) => void
  beginSaving: () => void
  reset: () => void
}

export const useRecordingStore = create<RecordingStore>((set) => ({
  phase: 'idle',
  sessionId: null,
  startedAt: null,
  liveGeometry: EMPTY_GEOMETRY,
  startRecording: (sessionId, startedAt) =>
    set({ phase: 'recording', sessionId, startedAt, liveGeometry: EMPTY_GEOMETRY }),
  hydrateFrom: (session, points) =>
    set({ phase: 'recording', sessionId: session.id, startedAt: session.startedAt, liveGeometry: { points } }),
  appendLivePoints: (points) =>
    set((s) => (points.length === 0 ? {} : { liveGeometry: { points: [...s.liveGeometry.points, ...points] } })),
  beginSaving: () => set({ phase: 'saving' }),
  reset: () => set({ phase: 'idle', sessionId: null, startedAt: null, liveGeometry: EMPTY_GEOMETRY }),
}))
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx jest src/recording` → PASS. `npx tsc --noEmit` → clean.

- [ ] **Step 7: Commit**

```bash
git add src/recording/track.ts src/recording/resume.ts src/recording/recordingStore.ts src/recording/__tests__
git commit -m "feat: recording pure logic (toTrackPoint, resumeActionFor) + session-only store (TDD)"
```

---

### Task 5: Location task + recording controller

**Files:**
- Create: `src/recording/options.ts`
- Create: `src/recording/locationTask.ts`
- Create: `src/recording/recordingController.ts`
- Modify: `package.json` (add `expo-task-manager` via `npx expo install`)

**Interfaces:**
- Consumes: `activitiesRepository` (Task 3); `useRecordingStore`, `toTrackPoint`, `resumeActionFor`, `ResumeAction` (Task 4).
- Produces: `RECORDING_TASK`, `startRecording`, `stopRecording`, `discardRecording`, `resumeIfActive`, `StartResult` (consumed by Tasks 9, 7, 10).

**Battery/API note:** verified against the SDK 57 docs (`https://docs.expo.dev/versions/v57.0.0/sdk/location/`): `startLocationUpdatesAsync(taskName, options)`, `stopLocationUpdatesAsync`, `hasStartedLocationUpdatesAsync`, `requestForegroundPermissionsAsync`, `requestBackgroundPermissionsAsync`, `getCurrentPositionAsync`, `Accuracy`, `ActivityType`, and the `foregroundService` / `deferredUpdates*` options. `TaskManager.defineTask` receives `{ data: { locations }, error }`.

- [ ] **Step 1: Install expo-task-manager**

Run: `npx expo install expo-task-manager`
Expected: `expo-task-manager` added to `package.json` dependencies (autolinked; native availability comes with the prebuild in Task 11).

- [ ] **Step 2: Define the capture options**

Create `src/recording/options.ts`:

```ts
import * as Location from 'expo-location'
import { lightColors } from '../theme/colors'

// Background capture tuning — the single source of truth. Batched delivery
// (deferredUpdates*) minimises process wakeups; distanceInterval caps redundant fixes.
export const RECORDING_OPTIONS: Location.LocationTaskOptions = {
  accuracy: Location.Accuracy.High,
  distanceInterval: 10,
  deferredUpdatesInterval: 15000,
  deferredUpdatesDistance: 50,
  pausesUpdatesAutomatically: false,
  activityType: Location.ActivityType.Fitness,
  foregroundService: {
    notificationTitle: 'On Foot',
    notificationBody: 'Recording your activity',
    notificationColor: lightColors.controlAccent,
  },
}
```

- [ ] **Step 3: Define the background task**

Create `src/recording/locationTask.ts`:

```ts
import * as Location from 'expo-location'
import * as TaskManager from 'expo-task-manager'
import { activitiesRepository } from '../data/activities'
import { useRecordingStore } from './recordingStore'
import { toTrackPoint } from './track'

export const RECORDING_TASK = 'onfoot-location-recording'

TaskManager.defineTask(RECORDING_TASK, async ({ data, error }) => {
  if (error || !data) return
  const { locations } = data as { locations: Location.LocationObject[] }
  if (!locations?.length) return
  const session = await activitiesRepository.getActiveSession()
  if (!session || session.endedAt != null) return
  const points = locations.map(toTrackPoint)
  await activitiesRepository.appendPoints(session.id, points)
  useRecordingStore.getState().appendLivePoints(points)
})
```

- [ ] **Step 4: Implement the controller**

Create `src/recording/recordingController.ts`:

```ts
import * as Location from 'expo-location'
import { activitiesRepository } from '../data/activities'
import { RECORDING_TASK } from './locationTask'
import { RECORDING_OPTIONS } from './options'
import { useRecordingStore } from './recordingStore'
import { resumeActionFor, ResumeAction } from './resume'
import { toTrackPoint } from './track'

export type StartResult = 'started' | 'permission-denied'

export async function startRecording(): Promise<StartResult> {
  const foreground = await Location.requestForegroundPermissionsAsync()
  if (!foreground.granted) return 'permission-denied'
  const background = await Location.requestBackgroundPermissionsAsync()
  if (!background.granted) return 'permission-denied'

  const startedAt = Date.now()
  const sessionId = await activitiesRepository.startSession(startedAt)
  useRecordingStore.getState().startRecording(sessionId, startedAt)
  await Location.startLocationUpdatesAsync(RECORDING_TASK, RECORDING_OPTIONS)
  return 'started'
}

export async function stopRecording(linkedTrailId: number | null): Promise<void> {
  const session = await activitiesRepository.getActiveSession()
  if (await Location.hasStartedLocationUpdatesAsync(RECORDING_TASK)) {
    await Location.stopLocationUpdatesAsync(RECORDING_TASK)
  }
  if (session && session.endedAt == null) {
    await activitiesRepository.markStopped(session.id, Date.now(), linkedTrailId)
  }
  useRecordingStore.getState().beginSaving()
}

export async function discardRecording(sessionId: number): Promise<void> {
  if (await Location.hasStartedLocationUpdatesAsync(RECORDING_TASK)) {
    await Location.stopLocationUpdatesAsync(RECORDING_TASK)
  }
  await activitiesRepository.discardSession(sessionId)
  useRecordingStore.getState().reset()
}

export async function resumeIfActive(): Promise<{ action: ResumeAction; sessionId: number | null }> {
  const session = await activitiesRepository.getActiveSession()
  const action = resumeActionFor(session)
  if (action === 'resume' && session) {
    const points = await activitiesRepository.getSessionPoints(session.id)
    useRecordingStore.getState().hydrateFrom(session, points)
    if (!(await Location.hasStartedLocationUpdatesAsync(RECORDING_TASK))) {
      await Location.startLocationUpdatesAsync(RECORDING_TASK, RECORDING_OPTIONS)
    }
    try {
      const now = await Location.getCurrentPositionAsync({ accuracy: RECORDING_OPTIONS.accuracy })
      const point = toTrackPoint(now)
      await activitiesRepository.appendPoints(session.id, [point])
      useRecordingStore.getState().appendLivePoints([point])
    } catch {
      // No immediate fix available; the next background batch will connect the gap.
    }
  }
  return { action, sessionId: session?.id ?? null }
}
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit` (clean) and `npx jest` (green — these modules are native and not unit-tested; the pure pieces they import are covered by Task 4). Do NOT attempt to run the task on device yet (needs the prebuild from Task 11).

- [ ] **Step 6: Commit**

```bash
git add src/recording/options.ts src/recording/locationTask.ts src/recording/recordingController.ts package.json package-lock.json
git commit -m "feat: background location task + recording controller (start/stop/discard/resume)"
```

---

### Task 6: ActivityForm + effort/duration helpers

**Files:**
- Create: `src/activities/effort.ts`
- Create: `src/activities/format.ts`
- Test: `src/activities/__tests__/format.test.ts`
- Create: `src/activities/EffortSelector.tsx`
- Create: `src/activities/ActivityForm.tsx`

**Interfaces:**
- Consumes: `Effort`, `ActivityMetrics` (Task 2); `formatDistance`, `formatElevation` (existing, `src/data/trails/gpx/metrics.ts`).
- Produces: `ActivityForm` + `ActivityFormValues` (consumed by Task 7); `EFFORTS`, `effortLabel`, `effortColor`, `formatDuration`.

- [ ] **Step 1: Write the failing duration-formatter test**

Create `src/activities/__tests__/format.test.ts`:

```ts
import { formatDuration } from '../format'

describe('formatDuration', () => {
  it('formats seconds under a minute', () => {
    expect(formatDuration(45)).toBe('45s')
  })
  it('formats whole minutes', () => {
    expect(formatDuration(600)).toBe('10m')
  })
  it('formats minutes + seconds', () => {
    expect(formatDuration(125)).toBe('2m 5s')
  })
  it('formats hours + minutes', () => {
    expect(formatDuration(3720)).toBe('1h 2m')
  })
  it('clamps negatives to 0s', () => {
    expect(formatDuration(-5)).toBe('0s')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/activities/__tests__/format.test.ts` → FAIL.

- [ ] **Step 3: Implement the formatter**

Create `src/activities/format.ts`:

```ts
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const hours = Math.floor(s / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  const seconds = s % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`
  return `${seconds}s`
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest src/activities/__tests__/format.test.ts` → PASS.

- [ ] **Step 5: Implement the effort helper**

Create `src/activities/effort.ts` (mirrors `src/trails/difficulty.ts`; reuses existing colours — no new theme fields):

```ts
import { Effort } from '../data/activities'
import { AppColors } from '../theme/colors'

export const EFFORTS: Effort[] = ['easy', 'moderate', 'hard', 'max']

const LABELS: Record<Effort, string> = { easy: 'Easy', moderate: 'Moderate', hard: 'Hard', max: 'Max' }

export function effortLabel(effort: Effort): string {
  return LABELS[effort]
}

export function effortColor(effort: Effort, colors: AppColors): string {
  switch (effort) {
    case 'easy': return colors.difficultyEasy
    case 'moderate': return colors.difficultyMedium
    case 'hard': return colors.difficultyHard
    case 'max': return colors.danger
  }
}
```

- [ ] **Step 6: Implement the EffortSelector**

Create `src/activities/EffortSelector.tsx` (mirrors `DifficultySelector`):

```tsx
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Effort } from '../data/activities'
import { useTheme } from '../theme/useTheme'
import { EFFORTS, effortColor, effortLabel } from './effort'

export function EffortSelector({ value, onChange }: { value: Effort | null; onChange: (e: Effort) => void }) {
  const c = useTheme()
  return (
    <View style={styles.row}>
      {EFFORTS.map((e) => {
        const selected = e === value
        return (
          <Pressable
            key={e}
            accessibilityLabel={`Effort ${effortLabel(e)}`}
            onPress={() => onChange(e)}
            style={[
              styles.chip,
              { borderColor: effortColor(e, c), backgroundColor: selected ? effortColor(e, c) : 'transparent' },
            ]}
          >
            <Text style={{ color: selected ? c.surface : effortColor(e, c), fontWeight: '600' }}>
              {effortLabel(e)}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  chip: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1.5 },
})
```

- [ ] **Step 7: Implement the ActivityForm**

Create `src/activities/ActivityForm.tsx`. Mirrors `TrailForm` but with an effort picker, an activity metrics summary (distance • duration • elevation), and Save + Discard. It does NOT navigate — the caller (save page) handles navigation on success. No header back button (Save or Discard are the only exits, reinforcing "no way to lose it").

```tsx
import { useCallback, useState } from 'react'
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native'
import { Stack } from 'expo-router'
import { ActivityMetrics, Effort } from '../data/activities'
import { formatDistance, formatElevation } from '../data/trails/gpx/metrics'
import { formatDuration } from './format'
import { EffortSelector } from './EffortSelector'
import { useTheme } from '../theme/useTheme'

export interface ActivityFormValues {
  name: string
  effort: Effort
  comments: string | null
}

export function ActivityForm({
  metrics,
  initialName,
  initialEffort,
  initialComments,
  onSave,
  onDiscard,
}: {
  metrics: ActivityMetrics
  initialName: string
  initialEffort: Effort | null
  initialComments: string
  onSave: (values: ActivityFormValues) => Promise<void>
  onDiscard: () => Promise<void>
}) {
  const c = useTheme()
  const [name, setName] = useState(initialName)
  const [effort, setEffort] = useState<Effort | null>(initialEffort)
  const [comments, setComments] = useState(initialComments)
  const [busy, setBusy] = useState(false)

  const canSave = name.trim().length > 0 && effort !== null && !busy

  const handleSave = useCallback(async () => {
    if (effort === null) return
    setBusy(true)
    try {
      await onSave({
        name: name.trim(),
        effort,
        comments: comments.trim().length > 0 ? comments.trim() : null,
      })
    } catch {
      Alert.alert('Could not save activity', 'Something went wrong while saving. Please try again.')
      setBusy(false)
    }
  }, [comments, effort, name, onSave])

  const handleDiscard = useCallback(() => {
    Alert.alert('Discard activity?', 'This recording will be permanently deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          setBusy(true)
          onDiscard().catch(() => {
            Alert.alert('Could not discard', 'Something went wrong. Please try again.')
            setBusy(false)
          })
        },
      },
    ])
  }, [onDiscard])

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen options={{ headerShown: true, title: 'Save activity', headerBackVisible: false }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={[styles.metrics, { backgroundColor: c.surface }]}>
            <Metric label="Distance" value={formatDistance(metrics.distanceMeters)} color={c.onSurface} muted={c.onSurfaceVariant} />
            <Metric label="Duration" value={formatDuration(metrics.durationSeconds)} color={c.onSurface} muted={c.onSurfaceVariant} />
            <Metric label="Elevation Gain" value={formatElevation(metrics.elevationGainMeters)} color={c.onSurface} muted={c.onSurfaceVariant} />
          </View>

          <Text style={[styles.label, { color: c.onSurface }]}>Name *</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Activity name"
            placeholderTextColor={c.onSurfaceVariant}
            style={[styles.input, { color: c.onSurface, borderColor: c.panelDivider }]}
          />

          <Text style={[styles.label, { color: c.onSurface }]}>Effort *</Text>
          <EffortSelector value={effort} onChange={setEffort} />

          <Text style={[styles.label, { color: c.onSurface }]}>Comments</Text>
          <TextInput
            value={comments}
            onChangeText={setComments}
            placeholder="Optional"
            placeholderTextColor={c.onSurfaceVariant}
            multiline
            style={[styles.input, styles.multiline, { color: c.onSurface, borderColor: c.panelDivider }]}
          />

          <Pressable
            accessibilityLabel="Save activity"
            disabled={!canSave}
            onPress={handleSave}
            style={[styles.save, { backgroundColor: c.controlAccent, opacity: canSave ? 1 : 0.5 }]}
          >
            {busy ? <ActivityIndicator color={c.surface} /> : <Text style={[styles.saveLabel, { color: c.surface }]}>Save activity</Text>}
          </Pressable>

          <Pressable accessibilityLabel="Discard activity" disabled={busy} onPress={handleDiscard} style={styles.discard}>
            <Text style={[styles.discardLabel, { color: c.danger }]}>Discard</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

function Metric({ label, value, color, muted }: { label: string; value: string; color: string; muted: string }) {
  return (
    <View style={styles.metricItem}>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: muted }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  metrics: { flexDirection: 'row', justifyContent: 'space-evenly', borderRadius: 12, padding: 16 },
  metricItem: { alignItems: 'center' },
  metricValue: { fontSize: 16, fontWeight: '700' },
  metricLabel: { fontSize: 12, marginTop: 2 },
  label: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 16 },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  save: { marginTop: 12, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  saveLabel: { fontSize: 16, fontWeight: '700' },
  discard: { marginTop: 4, paddingVertical: 12, alignItems: 'center' },
  discardLabel: { fontSize: 15, fontWeight: '600' },
})
```

- [ ] **Step 8: Verify**

Run: `npx jest src/activities` → PASS; `npx tsc --noEmit` → clean.

- [ ] **Step 9: Commit**

```bash
git add src/activities
git commit -m "feat: ActivityForm + effort selector + duration formatter (TDD)"
```

---

### Task 7: activitiesStore + save page

**Files:**
- Create: `src/store/activitiesStore.ts`
- Create: `app/activity/save.tsx`

**Interfaces:**
- Consumes: `activitiesRepository` (Task 3); `buildNewActivityInput`, `activityMetricsFromPoints` (Task 2); `discardRecording` (Task 5); `useRecordingStore` (Task 4); `ActivityForm` (Task 6).
- Produces: `useActivitiesStore` (used in full by slice 3); the `/activity/save` route (referenced by Tasks 9, 10).

- [ ] **Step 1: Implement the store**

Create `src/store/activitiesStore.ts` (mirrors `trailsStore`):

```ts
import { create } from 'zustand'
import { ActivitySummary, NewActivityInput, activitiesRepository } from '../data/activities'

interface ActivitiesStore {
  activities: ActivitySummary[]
  loadActivities: () => Promise<void>
  saveActivity: (sessionId: number, input: NewActivityInput) => Promise<number>
}

export const useActivitiesStore = create<ActivitiesStore>((set, get) => ({
  activities: [],
  loadActivities: async () => {
    set({ activities: await activitiesRepository.listSummaries() })
  },
  saveActivity: async (sessionId, input) => {
    const id = await activitiesRepository.saveActivity(sessionId, input)
    await get().loadActivities()
    return id
  },
}))
```

- [ ] **Step 2: Implement the save page**

Create `app/activity/save.tsx` (mirrors `app/trail/new.tsx`'s load-then-form shape):

```tsx
import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { RecordingSession, TrackPoint, activitiesRepository } from '../../src/data/activities'
import { activityMetricsFromPoints, buildNewActivityInput } from '../../src/data/activities/mapping'
import { useActivitiesStore } from '../../src/store/activitiesStore'
import { discardRecording } from '../../src/recording/recordingController'
import { useRecordingStore } from '../../src/recording/recordingStore'
import { ActivityForm } from '../../src/activities/ActivityForm'
import { useTheme } from '../../src/theme/useTheme'

export default function SaveActivityScreen() {
  const c = useTheme()
  const router = useRouter()
  const saveActivity = useActivitiesStore((s) => s.saveActivity)
  const resetRecording = useRecordingStore((s) => s.reset)

  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<RecordingSession | null>(null)
  const [points, setPoints] = useState<TrackPoint[]>([])

  useEffect(() => {
    let active = true
    activitiesRepository.getActiveSession().then(async (loaded) => {
      if (!active) return
      if (!loaded) {
        router.replace('/')
        return
      }
      const loadedPoints = await activitiesRepository.getSessionPoints(loaded.id)
      if (!active) return
      setSession(loaded)
      setPoints(loadedPoints)
      setLoading(false)
    })
    return () => { active = false }
  }, [router])

  if (loading || !session) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <ActivityIndicator size="large" color={c.controlAccent} />
      </View>
    )
  }

  const endedAt = session.endedAt ?? points[points.length - 1]?.t ?? session.startedAt
  const metrics = activityMetricsFromPoints(points, session.startedAt, endedAt)

  return (
    <ActivityForm
      metrics={metrics}
      initialName=""
      initialEffort={null}
      initialComments=""
      onSave={async ({ name, effort, comments }) => {
        await saveActivity(session.id, buildNewActivityInput(session, points, { name, effort, comments }))
        resetRecording()
        router.replace('/')
      }}
      onDiscard={async () => {
        await discardRecording(session.id)
        router.replace('/')
      }}
    />
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` (clean) and `npx jest` (green). If `tsc` runs in a worktree that has a stale `.expo/types` and flags the `router.replace('/')` (or a later task's `/activity/save`), regenerate typed routes with `npx expo export`. In a fresh worktree without `.expo/types`, route strings are permissive.

- [ ] **Step 4: Commit**

```bash
git add src/store/activitiesStore.ts app/activity/save.tsx
git commit -m "feat: activities store + save-activity page (save / discard)"
```

---

### Task 8: RouteLine map port + live recording overlay

**Files:**
- Modify: `src/map/provider/types.ts` (add `RouteLineProps` + `RouteLine` to `MapComponents`)
- Modify: `src/map/providers/mapbox/adapter.tsx` (implement `RouteLine`)
- Modify: `src/theme/colors.ts` (add `recordingLine`)
- Modify: `src/theme/tokens.ts` (add `recordingLineWidth`)
- Modify: `src/map/MapCanvas.tsx` (render the live overlay)

**Interfaces:**
- Consumes: `useRecordingStore` (Task 4); existing `toLineCoordinates` from `src/map/geo.ts`.
- Produces: the `RouteLine` port component (reused by slice 3).

- [ ] **Step 1: Declare the port shape**

In `src/map/provider/types.ts`, add above `TerrainProps`:

```ts
export interface RouteLineProps {
  // Polyline as [lng, lat] pairs, in order. A plain line — no arrows or endpoints.
  line: [number, number][]
  color: string
  lineWidth: number
}
```

Add `RouteLine` to `MapComponents`:

```ts
export interface MapComponents {
  View: React.ComponentType<MapViewProps>
  Camera: React.ForwardRefExoticComponent<CameraProps & React.RefAttributes<CameraController>>
  Terrain: React.ComponentType<TerrainProps>
  UserPuck: React.ComponentType<{}>
  TrailOverlay: React.ComponentType<TrailOverlayProps>
  RouteLine: React.ComponentType<RouteLineProps>
}
```

- [ ] **Step 2: Implement RouteLine in the mapbox adapter**

In `src/map/providers/mapbox/adapter.tsx`, add `RouteLineProps` to the type import, define the component after `TrailOverlay`, and add it to the exported `components`:

```tsx
const RouteLine = ({ line, color, lineWidth }: RouteLineProps) => {
  const shape = {
    type: 'Feature' as const,
    geometry: { type: 'LineString' as const, coordinates: line },
    properties: {},
  }
  return (
    <Mapbox.ShapeSource id="route-line-source" shape={shape}>
      <Mapbox.LineLayer
        id="route-line"
        style={{ lineColor: color, lineWidth, lineCap: 'round', lineJoin: 'round' }}
      />
    </Mapbox.ShapeSource>
  )
}
```

```tsx
export const mapboxProvider: MapProvider = {
  capabilities: mapboxCapabilities,
  components: { View, Camera, Terrain, UserPuck, TrailOverlay, RouteLine },
}
```

- [ ] **Step 3: Add the theme colour + token**

In `src/theme/colors.ts`, add `recordingLine: string` to `AppColors`, and a value to both palettes (distinct from the purple `trailLine`):
- `lightColors`: `recordingLine: '#FF5722',`
- `darkColors`: `recordingLine: '#FF7043',`

In `src/theme/tokens.ts`, add to `MapTokens`: `recordingLineWidth: 5,`

- [ ] **Step 4: Render the live overlay in MapCanvas**

In `src/map/MapCanvas.tsx`: add `useMemo` to the React import; destructure `RouteLine` from `components`; read the recording store; render the line when recording with ≥2 points.

Add import:
```tsx
import { useRecordingStore } from '../recording/recordingStore'
```
Destructure:
```tsx
const { View: MapView, Camera, Terrain, UserPuck, TrailOverlay, RouteLine } = components
```
Add derivations near the existing `points`/`hasTrail`:
```tsx
const recordingPhase = useRecordingStore((s) => s.phase)
const livePoints = useRecordingStore((s) => s.liveGeometry.points)
const showLiveTrack = recordingPhase === 'recording' && livePoints.length >= 2
const liveLine = useMemo(() => toLineCoordinates(livePoints), [livePoints])
```
Render inside `<MapView>`, after `<UserPuck />`:
```tsx
{showLiveTrack && (
  <RouteLine line={liveLine} color={c.recordingLine} lineWidth={MapTokens.recordingLineWidth} />
)}
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit` (clean) and `npx jest` (green). Live rendering is device-verified in Task 11 (needs the prebuild + a live recording).

- [ ] **Step 6: Commit**

```bash
git add src/map/provider/types.ts src/map/providers/mapbox/adapter.tsx src/theme/colors.ts src/theme/tokens.ts src/map/MapCanvas.tsx
git commit -m "feat: RouteLine map port + live recording overlay in MapCanvas"
```

---

### Task 9: RecordButton (play / hold-to-stop)

**Files:**
- Create: `src/assets/icons/play.tsx`
- Create: `src/assets/icons/stop.tsx`
- Modify: `src/theme/tokens.ts` (add `holdToStopMs`, `recordRingWidth`)
- Create: `src/map/RecordButton.tsx`
- Modify: `src/map/MapScreen.tsx` (mount the button)

**Interfaces:**
- Consumes: `useRecordingStore` (Task 4); `startRecording`, `stopRecording` (Task 5); `useMapStore.selectedTrailId` (existing); the `/activity/save` route (Task 7).
- Produces: the bottom-left record control.

- [ ] **Step 1: Add the play/stop icons**

Create `src/assets/icons/play.tsx`:
```tsx
import React from 'react'
import Svg, { Path } from 'react-native-svg'

export const PlayIcon = ({ size = 20, color = '#000' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M8 5v14l11-7z" fill={color} />
  </Svg>
)
```
Create `src/assets/icons/stop.tsx`:
```tsx
import React from 'react'
import Svg, { Rect } from 'react-native-svg'

export const StopIcon = ({ size = 20, color = '#000' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Rect x="6" y="6" width="12" height="12" rx="2" fill={color} />
  </Svg>
)
```

- [ ] **Step 2: Add tokens**

In `src/theme/tokens.ts`, add to `MapTokens`:
```ts
holdToStopMs: 1000,
recordRingWidth: 3,
```

- [ ] **Step 3: Implement the RecordButton**

Create `src/map/RecordButton.tsx`. Play (idle) starts on tap; while recording, a stop button requires a ~1s press-and-hold, with an SVG progress ring driven by Reanimated. On completed hold → `stopRecording(selectedTrailId)` then navigate to the save page.

```tsx
import React, { useCallback, useMemo } from 'react'
import { Alert, Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { runOnJS, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated'
import Svg, { Circle } from 'react-native-svg'
import { useRouter } from 'expo-router'
import { useTheme } from '../theme/useTheme'
import { MapTokens } from '../theme/tokens'
import { useRecordingStore } from '../recording/recordingStore'
import { startRecording, stopRecording } from '../recording/recordingController'
import { useMapStore } from '../store/mapStore'
import { PlayIcon } from '../assets/icons/play'
import { StopIcon } from '../assets/icons/stop'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

const SIZE = MapTokens.controlSize
const RING = MapTokens.recordRingWidth
const R = (SIZE - RING) / 2
const CENTER = SIZE / 2
const CIRCUMFERENCE = 2 * Math.PI * R

export function RecordButton() {
  const c = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const phase = useRecordingStore((s) => s.phase)
  const progress = useSharedValue(0)

  const onPlay = useCallback(async () => {
    const result = await startRecording()
    if (result === 'permission-denied') {
      Alert.alert(
        'Location permission needed',
        'To record your activity while the app is in the background, allow location access "All the time".',
      )
    }
  }, [])

  const doStop = useCallback(async () => {
    const linkedTrailId = useMapStore.getState().selectedTrailId
    await stopRecording(linkedTrailId)
    router.push('/activity/save')
  }, [router])

  const hold = useMemo(
    () =>
      Gesture.LongPress()
        .minDuration(MapTokens.holdToStopMs)
        .onBegin(() => {
          progress.value = withTiming(1, { duration: MapTokens.holdToStopMs })
        })
        .onStart(() => {
          runOnJS(doStop)()
        })
        .onFinalize(() => {
          progress.value = withTiming(0, { duration: 150 })
        })
        .runOnJS(false),
    [doStop, progress],
  )

  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }))

  if (phase === 'saving') return null

  return (
    <View style={[styles.anchor, { bottom: insets.bottom + MapTokens.overlayPadding, left: MapTokens.overlayPadding }]}>
      {phase === 'recording' ? (
        <GestureDetector gesture={hold}>
          <View style={[styles.btn, { backgroundColor: c.controlSurface }]}>
            <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
              <AnimatedCircle
                cx={CENTER}
                cy={CENTER}
                r={R}
                stroke={c.recordingLine}
                strokeWidth={RING}
                fill="none"
                strokeDasharray={CIRCUMFERENCE}
                animatedProps={ringProps}
                strokeLinecap="round"
                transform={`rotate(-90 ${CENTER} ${CENTER})`}
              />
            </Svg>
            <StopIcon size={MapTokens.controlIconSize} color={c.recordingLine} />
          </View>
        </GestureDetector>
      ) : (
        <Pressable
          accessibilityLabel="Start recording"
          onPress={onPlay}
          style={[styles.btn, { backgroundColor: c.controlSurface }]}
        >
          <PlayIcon size={MapTokens.controlIconSize} color={c.recordingLine} />
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute' },
  btn: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
})
```

- [ ] **Step 4: Mount it in MapScreen**

In `src/map/MapScreen.tsx`, import and render `<RecordButton />` inside the main `<View style={{ flex: 1 }}>` (a sibling of `MapControls`; it self-anchors bottom-left):

```tsx
import { RecordButton } from './RecordButton'
```
```tsx
<MapCanvas trail={trail} />
<RecordButton />
<MapControls
  onOpenLayers={() => sheetRef.current?.present()}
  extraBottom={trail ? cardHeight + MapTokens.controlsSpacing : 0}
/>
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit` (clean) and `npx jest` (green). Gesture + ring + start/stop are device-verified in Task 11.

- [ ] **Step 6: Commit**

```bash
git add src/assets/icons/play.tsx src/assets/icons/stop.tsx src/theme/tokens.ts src/map/RecordButton.tsx src/map/MapScreen.tsx
git commit -m "feat: bottom-left record button with play + hold-to-stop progress ring"
```

---

### Task 10: Launch resume wiring

**Files:**
- Create: `src/recording/useResumeRecording.ts`
- Modify: `app/_layout.tsx` (register the task + mount the resume handler)

**Interfaces:**
- Consumes: `resumeIfActive` (Task 5); `RECORDING_TASK` registration side effect (Task 5); the `/activity/save` route (Task 7).
- Produces: launch-time resume/route behavior.

- [ ] **Step 1: Implement the resume hook**

Create `src/recording/useResumeRecording.ts` (mirrors the nav-ready gating of `useIncomingShare`; runs once):

```ts
import { useEffect, useRef } from 'react'
import { useRootNavigationState, useRouter } from 'expo-router'
import { resumeIfActive } from './recordingController'

export function useResumeRecording() {
  const router = useRouter()
  const navState = useRootNavigationState()
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current || !navState?.key) return
    handled.current = true
    resumeIfActive().then(({ action }) => {
      if (action === 'save') router.push('/activity/save')
    })
  }, [navState?.key, router])
}
```

- [ ] **Step 2: Register the task + mount the handler in the root layout**

In `app/_layout.tsx`: add the side-effect import that registers the background task (top of file, with the other imports), and mount a resume handler alongside `ShareIntentHandler` (inside the `success` branch, so it runs after migrations):

```tsx
import '../src/recording/locationTask'
import { useResumeRecording } from '../src/recording/useResumeRecording'
```
```tsx
function ResumeRecordingHandler() {
  useResumeRecording()
  return null
}
```
Render it next to `ShareIntentHandler`:
```tsx
<>
  <Stack screenOptions={{ headerShown: false }} />
  <ShareIntentHandler />
  <ResumeRecordingHandler />
</>
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` (clean) and `npx jest` (green). Resume behavior is device-verified in Task 11.

- [ ] **Step 4: Commit**

```bash
git add src/recording/useResumeRecording.ts app/_layout.tsx
git commit -m "feat: resume recording (or reopen save page) on launch"
```

---

### Task 11: Config, clean prebuild & device verification

**Files:**
- Modify: `app.config.ts` (expo-location background + foreground-service options)

**Interfaces:**
- Consumes: everything above. This task turns the code into a working native build.

- [ ] **Step 1: Enable background location + foreground service in the config**

In `app.config.ts`, replace the bare `"expo-location"` plugin entry with the options form:

```ts
[
  "expo-location",
  {
    isAndroidBackgroundLocationEnabled: true,
    isAndroidForegroundServiceEnabled: true,
    locationAlwaysAndWhenInUsePermission:
      "Allow On Foot to record your activity while the app is in the background.",
  },
],
```

(`expo-task-manager` is autolinked — no `plugins` entry needed. It was installed in Task 5.)

- [ ] **Step 2: Verify the config + full suite**

Run: `npx tsc --noEmit` (clean), `npx jest` (all green), and `npx expo export` (confirms the bundle builds with the new modules — a fresh Metro, catching resolution issues the dev server can miss; also regenerates `.expo/types`).

- [ ] **Step 3: Clean prebuild + native build**

Run (via the project's nix shell, mirroring prior native work):
```
nix-shell --run "npx expo prebuild --clean"
nix-shell --run "npx expo run:android"
```
The clean prebuild is required so the new `ACCESS_BACKGROUND_LOCATION` + foreground-service permissions merge into the existing `/android` manifest (a plain `run:android` won't merge them). Confirm the build installs on device SWWC4HEIYHZPQWZX.

- [ ] **Step 4: Device verification (the durability guarantees)**

Verify on the device and report results:
1. Tap **play** → background permission prompt → grant "Allow all the time"; a persistent "On Foot — Recording your activity" notification appears; the live line grows as you move.
2. Turn the screen off / background the app for a bit → return → the line includes the points captured while away.
3. **Force-stop the app mid-recording → reopen** → recording resumes; the stop button is shown; a **straight line bridges the gap** from the last point to your current position.
4. **Hold** the stop button (~1s, ring fills) → the **save page** opens with distance/duration/elevation.
5. On the save page, **force-stop the app → reopen** → the **save page returns** with the same pending activity.
6. Fill name + effort, **Save** → returns to the map; verify the activity row exists (metrics populated). Record another and **Discard** → no row, no leftover `recording_sessions`/`recording_points`.
7. Record while a trail is displayed → **stop while it is still shown** → saved activity's `linkedTrailId` = that trail. Record with no trail shown → `linkedTrailId` null.
8. Deny the background permission → clear explanation, no recording starts.

- [ ] **Step 5: Commit**

```bash
git add app.config.ts
git commit -m "feat: enable background location + foreground service (clean prebuild required)"
```

Note: `/android` and `/ios` are gitignored (prebuild output is not committed), consistent with prior native work.

---

## Self-Review

**Spec coverage:**
- Play → hold-to-stop button, bottom-left → Task 9. ✅
- Background GPS capture + foreground service → Tasks 5, 11. ✅
- Durable point-by-point persistence → Tasks 1, 3, 5. ✅
- Live growing overlay → Task 8. ✅
- Resume after kill (recording phase, straight line) → Tasks 5, 10. ✅
- Resume after kill (awaiting-save phase, reopen save page) → Tasks 5, 7, 10. ✅
- Save page (name/effort/comments) + Discard → Tasks 6, 7. ✅
- `activities` + `recording_sessions` + `recording_points` tables → Task 1. ✅
- Link to displayed trail (at stop) → Task 9 (`stopRecording(selectedTrailId)`) + Task 3 (`markStopped`) + Task 7 (`buildNewActivityInput` uses `session.linkedTrailId`). ✅
- Battery minimalism → Task 5 (`RECORDING_OPTIONS`) + `locationTask` least-work callback. ✅
- No-way-to-lose invariant (session row) → Tasks 1, 3, 5, 7, 10. ✅

**Ordering / dependency safety:** the `/activity/save` route is created in Task 7, before it is referenced in Task 9 (RecordButton) and Task 10 (resume) — so `tsc` sees it in a strict (main) worktree; in a fresh SDD worktree route strings are permissive regardless.

**Type consistency:** `saveActivity(sessionId, input)` used identically in Task 3 (impl), Task 7 (store + page). `buildNewActivityInput(session, points, form)` signature matches Task 2 def and Task 7 call. `ActivityFormValues`/`onSave`/`onDiscard` props match between Task 6 (def) and Task 7 (use). `RouteLineProps` matches between Task 8 port def, adapter impl, and MapCanvas use. `resumeIfActive()` return `{action, sessionId}` matches Task 5 def and Task 10 use. `TrackPoint` superset of `GpxPoint` relied on in Task 2 (`computeMetrics`) and Task 8 (`toLineCoordinates`).

**Placeholder scan:** none — every step carries its concrete code or exact command.
