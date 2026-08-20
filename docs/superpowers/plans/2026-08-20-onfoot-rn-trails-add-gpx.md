# Trails Add-a-GPX Vertical Slice — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the empty Trails tab into a working, persisted feature — import a GPX file (bottom button *or* OS "open with"), review computed metrics, name/classify/describe it, save it, and see it listed.

**Architecture:** A persistence seam mirroring the map-provider seam: pure GPX parse/metrics/mapping modules (TDD'd), an engine-agnostic `TrailsRepository` port, a SQLite-backed implementation confined to `src/data/db/`, a thin Zustand cache (`trailsStore`), and two screens (list + add-GPX form) reached from both entry points via one shared import path.

**Tech Stack:** Expo SDK 57 (prebuild), React Native 0.86, TypeScript, expo-router (typed routes on), Zustand 5, expo-sqlite + drizzle-orm (+ drizzle-kit), fast-xml-parser, expo-document-picker, expo-file-system, Jest (jest-expo).

## Global Constraints

- **Read the versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing native/config code.** (AGENTS.md)
- **Persistence seam is inviolable:** only `src/data/db/*` may import `expo-sqlite`/`drizzle-orm`. Store and UI depend on the `TrailsRepository` interface and domain types only — never on Drizzle/SQLite types or raw SQL.
- **Pure logic is TDD'd** (`src/**/__tests__/`, tests first); **native rendering, gestures, camera, file I/O, and DB round-trips are device-verified**, not unit-tested.
- **Persist the minimum:** SQLite is the source of truth; `trailsStore` persists nothing.
- **No dead UI:** deferred controls (edit, card-tap "show on map", photos) are omitted this slice, not stubbed.
- **Comment style** (AGENTS.md): no change-narrating comments; code self-documenting; comment only non-obvious *why*.
- **Verbatim copy strings** (match Kotlin): button `Add a GPX file`; empty state `No trails saved yet.`; form save button `I'm done`; delete dialog title `Delete Trail`, body `Are you sure you want to delete "<name>"? This action cannot be undone.`, buttons `Delete` / `Cancel`.
- **Domain vocabulary:** `Difficulty = 'easy' | 'medium' | 'hard'`; metrics `{ distanceMeters, elevationGainMeters, elevationLossMeters }`; distance `>= 1000` → `"%.1f km"` else `"%.0f m"`; elevation `"%.0f m"`.
- **Ordering:** `listSummaries()` returns newest first (by `createdAt` desc).
- **Geometry** persisted as a JSON string column `{ points, waypoints }`; single `trails` table this slice.

---

## File Structure

**Create**
- `src/data/trails/types.ts` — engine-free domain types.
- `src/data/trails/gpx/metrics.ts` — Haversine distance, gain/loss, formatters (pure).
- `src/data/trails/gpx/parse.ts` — GPX XML → `{ points, waypoints, title }` (pure).
- `src/data/trails/gpx/readFile.ts` — read a file URI into a string (expo-file-system wrapper).
- `src/data/trails/mapping.ts` — row ↔ domain + geometry (de)serialization (pure).
- `src/data/trails/repository.ts` — `TrailsRepository` PORT interface (no engine import).
- `src/data/trails/index.ts` — composition: re-exports types/port + binds `trailsRepository` to the SQLite impl.
- `src/data/db/schema.ts` — Drizzle `trails` table.
- `src/data/db/client.ts` — expo-sqlite + Drizzle handle (ONLY engine import site).
- `src/data/db/trailsRepository.ts` — SQLite-backed `TrailsRepository`.
- `src/data/db/migrations/*` — drizzle-kit generated (do not hand-edit).
- `drizzle.config.ts` — drizzle-kit config (repo root).
- `src/store/trailsStore.ts` — Zustand cache over the repository.
- `src/trails/difficulty.ts` — `difficultyLabel`, `difficultyColor` (pure-ish helpers).
- `src/trails/DifficultyBadge.tsx`, `src/trails/MetricsRow.tsx`, `src/trails/TrailListItem.tsx`, `src/trails/DifficultySelector.tsx` — presentational.
- `app/trail/new.tsx` — add-GPX form (stack route).
- Test files under the matching `__tests__/` dirs.

**Modify**
- `app/(tabs)/trails.tsx` — replace placeholder with the list screen.
- `app/_layout.tsx` — run Drizzle migrations before rendering; host the Door B linking handler.
- `src/theme/colors.ts` (+ its test) — add difficulty colors to `AppColors`.
- `app.config.ts` — Android intent filters (Door B) + any plugins.
- `package.json` — new deps + a `db:generate` script.

---

### Task 1: Domain types + GPX metrics (pure, TDD)

**Files:**
- Create: `src/data/trails/types.ts`
- Create: `src/data/trails/gpx/metrics.ts`
- Test: `src/data/trails/__tests__/metrics.test.ts`

**Interfaces:**
- Produces (`types.ts`):
  ```ts
  export interface GpxPoint { lat: number; lng: number; ele: number | null }
  export interface GpxWaypoint {
    lat: number; lng: number; ele: number | null
    name: string | null; description: string | null
  }
  export type Difficulty = 'easy' | 'medium' | 'hard'
  export interface TrailMetrics {
    distanceMeters: number; elevationGainMeters: number; elevationLossMeters: number
  }
  export interface TrailGeometry { points: GpxPoint[]; waypoints: GpxWaypoint[] }
  export interface NewTrailInput {
    name: string; difficulty: Difficulty; description: string | null
    metrics: TrailMetrics; geometry: TrailGeometry
  }
  export interface TrailSummary {
    id: number; name: string; difficulty: Difficulty
    metrics: TrailMetrics; createdAt: number
  }
  export interface Trail extends TrailSummary {
    description: string | null; geometry: TrailGeometry; updatedAt: number
  }
  ```
- Produces (`metrics.ts`): `haversineMeters(aLat,aLng,bLat,bLng): number`, `computeMetrics(points: GpxPoint[]): TrailMetrics`, `formatDistance(m: number): string`, `formatElevation(m: number): string`.

- [ ] **Step 1: Write the failing test**

`src/data/trails/__tests__/metrics.test.ts`:
```ts
import { haversineMeters, computeMetrics, formatDistance, formatElevation } from '../gpx/metrics'
import { GpxPoint } from '../types'

const p = (lat: number, lng: number, ele: number | null = null): GpxPoint => ({ lat, lng, ele })

describe('haversineMeters', () => {
  test('one degree of longitude at the equator is ~111.32 km', () => {
    expect(haversineMeters(0, 0, 0, 1)).toBeCloseTo(111319.49, 0)
  })
  test('identical points are zero distance', () => {
    expect(haversineMeters(45, 3, 45, 3)).toBe(0)
  })
})

describe('computeMetrics', () => {
  test('empty and single-point lists yield zeros', () => {
    expect(computeMetrics([])).toEqual({ distanceMeters: 0, elevationGainMeters: 0, elevationLossMeters: 0 })
    expect(computeMetrics([p(1, 1, 10)])).toEqual({ distanceMeters: 0, elevationGainMeters: 0, elevationLossMeters: 0 })
  })
  test('sums distance and splits elevation into gain and loss', () => {
    const m = computeMetrics([p(0, 0, 100), p(0, 0, 130), p(0, 0, 110)])
    expect(m.distanceMeters).toBe(0)
    expect(m.elevationGainMeters).toBe(30)
    expect(m.elevationLossMeters).toBe(20)
  })
  test('skips elevation deltas when either endpoint lacks elevation', () => {
    const m = computeMetrics([p(0, 0, 100), p(0, 0, null), p(0, 0, 200)])
    expect(m.elevationGainMeters).toBe(0)
    expect(m.elevationLossMeters).toBe(0)
  })
})

describe('formatters', () => {
  test('formatDistance switches to km at 1000 m', () => {
    expect(formatDistance(450)).toBe('450 m')
    expect(formatDistance(1500)).toBe('1.5 km')
    expect(formatDistance(1000)).toBe('1.0 km')
  })
  test('formatElevation rounds to whole metres', () => {
    expect(formatElevation(250.4)).toBe('250 m')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/data/trails/__tests__/metrics.test.ts`
Expected: FAIL — cannot find module `../gpx/metrics` (and `../types`).

- [ ] **Step 3: Write `types.ts`, then the implementation**

Create `src/data/trails/types.ts` with the exact block from **Interfaces → Produces (`types.ts`)** above.

Create `src/data/trails/gpx/metrics.ts`:
```ts
import { GpxPoint, TrailMetrics } from '../types'

const EARTH_RADIUS_M = 6371000

const toRad = (deg: number): number => (deg * Math.PI) / 180

export function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const lat1 = toRad(aLat)
  const lat2 = toRad(bLat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function computeMetrics(points: GpxPoint[]): TrailMetrics {
  let distanceMeters = 0
  let elevationGainMeters = 0
  let elevationLossMeters = 0
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const cur = points[i]
    distanceMeters += haversineMeters(prev.lat, prev.lng, cur.lat, cur.lng)
    if (prev.ele !== null && cur.ele !== null) {
      const delta = cur.ele - prev.ele
      if (delta > 0) elevationGainMeters += delta
      else elevationLossMeters += Math.abs(delta)
    }
  }
  return { distanceMeters, elevationGainMeters, elevationLossMeters }
}

export function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters.toFixed(0)} m`
}

export function formatElevation(meters: number): string {
  return `${meters.toFixed(0)} m`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/data/trails/__tests__/metrics.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit`
```bash
git add src/data/trails/types.ts src/data/trails/gpx/metrics.ts src/data/trails/__tests__/metrics.test.ts
git commit -m "feat: trail domain types + pure GPX metrics"
```

---

### Task 2: GPX parser (pure, TDD)

**Files:**
- Create: `src/data/trails/gpx/parse.ts`
- Test: `src/data/trails/__tests__/parse.test.ts`
- Modify: `package.json` (add `fast-xml-parser`)

**Interfaces:**
- Consumes: `GpxPoint`, `GpxWaypoint` from `src/data/trails/types.ts`.
- Produces:
  ```ts
  export interface GpxParseResult { points: GpxPoint[]; waypoints: GpxWaypoint[]; title: string | null }
  export function parseGpx(xml: string, fallbackName?: string | null): GpxParseResult
  ```
  Rules: prefer `<rte>` points over `<trk>` when any route exists; merge segments/routes in document order; always collect `<wpt>`; title precedence `<trk><name>` → `<metadata><name>` → `fallbackName`; namespaces stripped; a point/waypoint missing `lat`/`lon` throws.

- [ ] **Step 1: Install the parser dependency**

Run: `npx expo install fast-xml-parser` (pure JS — no native rebuild). Confirm it lands in `package.json` dependencies.

- [ ] **Step 2: Write the failing test**

`src/data/trails/__tests__/parse.test.ts`:
```ts
import { parseGpx } from '../gpx/parse'

const TRACK = `<?xml version="1.0"?>
<gpx><metadata><name>Meta Name</name></metadata>
<trk><name>Track Name</name><trkseg>
<trkpt lat="1.0" lon="2.0"><ele>100</ele></trkpt>
<trkpt lat="1.1" lon="2.1"><ele>110</ele></trkpt>
</trkseg></trk>
<wpt lat="1.0" lon="2.0"><name>WP</name><desc>hi</desc></wpt></gpx>`

const ROUTE_AND_TRACK = `<?xml version="1.0"?>
<gpx><rte><rtept lat="5.0" lon="6.0"/><rtept lat="5.1" lon="6.1"/></rte>
<trk><trkseg><trkpt lat="9.0" lon="9.0"/></trkseg></trk></gpx>`

const NAMESPACED = `<?xml version="1.0"?>
<gpx xmlns:gpx="http://x"><trk><gpx:name>NS Track</gpx:name><trkseg>
<trkpt lat="3.0" lon="4.0"><gpx:ele>50</gpx:ele></trkpt></trkseg></trk></gpx>`

const METADATA_ONLY = `<?xml version="1.0"?>
<gpx><metadata><name>Only Meta</name></metadata>
<trk><trkseg><trkpt lat="1" lon="1"/></trkseg></trk></gpx>`

const NO_NAMES = `<?xml version="1.0"?>
<gpx><trk><trkseg><trkpt lat="1" lon="1"/></trkseg></trk></gpx>`

const MISSING_LAT = `<?xml version="1.0"?>
<gpx><trk><trkseg><trkpt lon="1"/></trkseg></trk></gpx>`

test('track: points, elevation, waypoints, and track-name title', () => {
  const r = parseGpx(TRACK)
  expect(r.points).toEqual([
    { lat: 1.0, lng: 2.0, ele: 100 },
    { lat: 1.1, lng: 2.1, ele: 110 },
  ])
  expect(r.waypoints).toEqual([{ lat: 1.0, lng: 2.0, ele: null, name: 'WP', description: 'hi' }])
  expect(r.title).toBe('Track Name')
})

test('route points win over track points when a route exists', () => {
  const r = parseGpx(ROUTE_AND_TRACK)
  expect(r.points).toEqual([
    { lat: 5.0, lng: 6.0, ele: null },
    { lat: 5.1, lng: 6.1, ele: null },
  ])
})

test('namespace prefixes are stripped from tags', () => {
  const r = parseGpx(NAMESPACED)
  expect(r.points).toEqual([{ lat: 3.0, lng: 4.0, ele: 50 }])
  expect(r.title).toBe('NS Track')
})

test('title falls back to metadata name, then to the provided fallback', () => {
  expect(parseGpx(METADATA_ONLY).title).toBe('Only Meta')
  expect(parseGpx(NO_NAMES, 'file-name').title).toBe('file-name')
  expect(parseGpx(NO_NAMES).title).toBeNull()
})

test('a point missing lat or lon throws', () => {
  expect(() => parseGpx(MISSING_LAT)).toThrow()
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest src/data/trails/__tests__/parse.test.ts`
Expected: FAIL — cannot find module `../gpx/parse`.

- [ ] **Step 4: Write the implementation**

Create `src/data/trails/gpx/parse.ts`:
```ts
import { XMLParser } from 'fast-xml-parser'
import { GpxPoint, GpxWaypoint } from '../types'

export interface GpxParseResult {
  points: GpxPoint[]
  waypoints: GpxWaypoint[]
  title: string | null
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
})

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

function num(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null
  const n = typeof value === 'number' ? value : parseFloat(String(value))
  return Number.isFinite(n) ? n : null
}

function str(value: unknown): string | null {
  if (value === undefined || value === null) return null
  const s = String(value).trim()
  return s.length === 0 ? null : s
}

function requireCoord(node: any, kind: string): { lat: number; lng: number } {
  const lat = num(node?.['@_lat'])
  const lng = num(node?.['@_lon'])
  if (lat === null || lng === null) throw new Error(`GPX ${kind} missing lat/lon`)
  return { lat, lng }
}

function toPoint(node: any): GpxPoint {
  const { lat, lng } = requireCoord(node, 'point')
  return { lat, lng, ele: num(node?.ele) }
}

function toWaypoint(node: any): GpxWaypoint {
  const { lat, lng } = requireCoord(node, 'waypoint')
  return { lat, lng, ele: num(node?.ele), name: str(node?.name), description: str(node?.desc) }
}

export function parseGpx(xml: string, fallbackName: string | null = null): GpxParseResult {
  const gpx = parser.parse(xml)?.gpx ?? {}

  const waypoints = asArray(gpx.wpt).map(toWaypoint)

  const routes = asArray(gpx.rte)
  const points =
    routes.length > 0
      ? routes.flatMap((rte: any) => asArray(rte.rtept).map(toPoint))
      : asArray(gpx.trk).flatMap((trk: any) =>
          asArray(trk.trkseg).flatMap((seg: any) => asArray(seg.trkpt).map(toPoint)),
        )

  const trackTitle = str(asArray(gpx.trk)[0]?.name)
  const metadataTitle = str(gpx.metadata?.name)
  const title = trackTitle ?? metadataTitle ?? str(fallbackName)

  return { points, waypoints, title }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/data/trails/__tests__/parse.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck + commit**

Run: `npx tsc --noEmit`
```bash
git add package.json package-lock.json src/data/trails/gpx/parse.ts src/data/trails/__tests__/parse.test.ts
git commit -m "feat: pure GPX parser (fast-xml-parser)"
```

---

### Task 3: Trail row mapping (pure, TDD)

**Files:**
- Create: `src/data/trails/mapping.ts`
- Test: `src/data/trails/__tests__/mapping.test.ts`

**Interfaces:**
- Consumes: `NewTrailInput`, `Trail`, `TrailSummary`, `TrailGeometry`, `Difficulty` from `types.ts`.
- Produces:
  ```ts
  export interface TrailRow {
    id: number; name: string; difficulty: string
    distanceMeters: number; elevationGainMeters: number; elevationLossMeters: number
    description: string | null; geometry: string; createdAt: number; updatedAt: number
  }
  export function serializeGeometry(g: TrailGeometry): string
  export function deserializeGeometry(json: string): TrailGeometry
  export function rowToSummary(row: TrailRow): TrailSummary
  export function rowToTrail(row: TrailRow): Trail
  export interface TrailInsertValues {
    name: string; difficulty: string
    distanceMeters: number; elevationGainMeters: number; elevationLossMeters: number
    description: string | null; geometry: string; createdAt: number; updatedAt: number
  }
  export function inputToInsertValues(input: NewTrailInput, now: number): TrailInsertValues
  ```

- [ ] **Step 1: Write the failing test**

`src/data/trails/__tests__/mapping.test.ts`:
```ts
import { serializeGeometry, deserializeGeometry, rowToSummary, rowToTrail, inputToInsertValues, TrailRow } from '../mapping'
import { NewTrailInput } from '../types'

const ROW: TrailRow = {
  id: 7, name: 'Ridge', difficulty: 'hard',
  distanceMeters: 5200, elevationGainMeters: 250, elevationLossMeters: 180,
  description: 'nice', geometry: '{"points":[{"lat":1,"lng":2,"ele":10}],"waypoints":[]}',
  createdAt: 1000, updatedAt: 2000,
}

test('geometry round-trips through JSON', () => {
  const g = { points: [{ lat: 1, lng: 2, ele: null }], waypoints: [] }
  expect(deserializeGeometry(serializeGeometry(g))).toEqual(g)
})

test('deserializeGeometry defaults missing arrays to empty', () => {
  expect(deserializeGeometry('{}')).toEqual({ points: [], waypoints: [] })
})

test('rowToSummary exposes list fields and omits geometry/description', () => {
  const s = rowToSummary(ROW)
  expect(s).toEqual({
    id: 7, name: 'Ridge', difficulty: 'hard',
    metrics: { distanceMeters: 5200, elevationGainMeters: 250, elevationLossMeters: 180 },
    createdAt: 1000,
  })
  expect(s).not.toHaveProperty('geometry')
})

test('rowToTrail adds description, geometry, updatedAt', () => {
  const t = rowToTrail(ROW)
  expect(t.description).toBe('nice')
  expect(t.geometry).toEqual({ points: [{ lat: 1, lng: 2, ele: 10 }], waypoints: [] })
  expect(t.updatedAt).toBe(2000)
})

test('inputToInsertValues serializes geometry and stamps both timestamps', () => {
  const input: NewTrailInput = {
    name: 'A', difficulty: 'easy', description: null,
    metrics: { distanceMeters: 1, elevationGainMeters: 2, elevationLossMeters: 3 },
    geometry: { points: [], waypoints: [] },
  }
  const v = inputToInsertValues(input, 555)
  expect(v).toEqual({
    name: 'A', difficulty: 'easy',
    distanceMeters: 1, elevationGainMeters: 2, elevationLossMeters: 3,
    description: null, geometry: '{"points":[],"waypoints":[]}',
    createdAt: 555, updatedAt: 555,
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/data/trails/__tests__/mapping.test.ts`
Expected: FAIL — cannot find module `../mapping`.

- [ ] **Step 3: Write the implementation**

Create `src/data/trails/mapping.ts`:
```ts
import { Difficulty, NewTrailInput, Trail, TrailGeometry, TrailSummary } from './types'

export interface TrailRow {
  id: number
  name: string
  difficulty: string
  distanceMeters: number
  elevationGainMeters: number
  elevationLossMeters: number
  description: string | null
  geometry: string
  createdAt: number
  updatedAt: number
}

export interface TrailInsertValues {
  name: string
  difficulty: string
  distanceMeters: number
  elevationGainMeters: number
  elevationLossMeters: number
  description: string | null
  geometry: string
  createdAt: number
  updatedAt: number
}

export function serializeGeometry(geometry: TrailGeometry): string {
  return JSON.stringify(geometry)
}

export function deserializeGeometry(json: string): TrailGeometry {
  const parsed = JSON.parse(json) as Partial<TrailGeometry>
  return { points: parsed.points ?? [], waypoints: parsed.waypoints ?? [] }
}

export function rowToSummary(row: TrailRow): TrailSummary {
  return {
    id: row.id,
    name: row.name,
    difficulty: row.difficulty as Difficulty,
    metrics: {
      distanceMeters: row.distanceMeters,
      elevationGainMeters: row.elevationGainMeters,
      elevationLossMeters: row.elevationLossMeters,
    },
    createdAt: row.createdAt,
  }
}

export function rowToTrail(row: TrailRow): Trail {
  return {
    ...rowToSummary(row),
    description: row.description,
    geometry: deserializeGeometry(row.geometry),
    updatedAt: row.updatedAt,
  }
}

export function inputToInsertValues(input: NewTrailInput, now: number): TrailInsertValues {
  return {
    name: input.name,
    difficulty: input.difficulty,
    distanceMeters: input.metrics.distanceMeters,
    elevationGainMeters: input.metrics.elevationGainMeters,
    elevationLossMeters: input.metrics.elevationLossMeters,
    description: input.description,
    geometry: serializeGeometry(input.geometry),
    createdAt: now,
    updatedAt: now,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/data/trails/__tests__/mapping.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit`
```bash
git add src/data/trails/mapping.ts src/data/trails/__tests__/mapping.test.ts
git commit -m "feat: pure trail row <-> domain mapping"
```

---

### Task 4: Persistence — deps, Drizzle schema/client/migrations, repository, migration bootstrap (device-verified)

**Files:**
- Create: `src/data/trails/repository.ts` (PORT), `src/data/trails/index.ts` (composition)
- Create: `src/data/db/schema.ts`, `src/data/db/client.ts`, `src/data/db/trailsRepository.ts`
- Create: `drizzle.config.ts`, `src/data/db/migrations/*` (generated)
- Modify: `app/_layout.tsx` (run migrations before rendering), `package.json` (deps + script)

**Interfaces:**
- Consumes: `mapping.ts` helpers; `types.ts` domain types.
- Produces:
  ```ts
  // src/data/trails/repository.ts
  export interface TrailsRepository {
    listSummaries(): Promise<TrailSummary[]>          // newest first
    getTrail(id: number): Promise<Trail | null>
    createTrail(input: NewTrailInput): Promise<number>  // returns new id
    deleteTrail(id: number): Promise<void>
  }
  // src/data/trails/index.ts
  export const trailsRepository: TrailsRepository       // bound to the SQLite impl
  export * from './types'
  export * from './repository'
  ```

- [ ] **Step 1: Install native + ORM dependencies**

Run: `npx expo install expo-sqlite expo-file-system expo-document-picker drizzle-orm` and `npm i -D drizzle-kit`.
(These bring in the native modules used here and in Tasks 8–9, so the single rebuild in Step 8 covers them all. Confirm versions land in `package.json`.)

- [ ] **Step 2: Write the port interface + composition module**

Create `src/data/trails/repository.ts`:
```ts
import { NewTrailInput, Trail, TrailSummary } from './types'

export interface TrailsRepository {
  listSummaries(): Promise<TrailSummary[]>
  getTrail(id: number): Promise<Trail | null>
  createTrail(input: NewTrailInput): Promise<number>
  deleteTrail(id: number): Promise<void>
}
```

Create `src/data/trails/index.ts`:
```ts
import { sqliteTrailsRepository } from '../db/trailsRepository'
import { TrailsRepository } from './repository'

export const trailsRepository: TrailsRepository = sqliteTrailsRepository

export * from './types'
export * from './repository'
```

- [ ] **Step 3: Write the Drizzle schema**

Create `src/data/db/schema.ts`:
```ts
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const trails = sqliteTable('trails', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  difficulty: text('difficulty').notNull(),
  distanceMeters: real('distance_meters').notNull(),
  elevationGainMeters: real('elevation_gain_meters').notNull(),
  elevationLossMeters: real('elevation_loss_meters').notNull(),
  description: text('description'),
  geometry: text('geometry').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})
```

- [ ] **Step 4: Write the DB client (the only engine import site)**

Create `src/data/db/client.ts`:
```ts
import { drizzle } from 'drizzle-orm/expo-sqlite'
import { openDatabaseSync } from 'expo-sqlite'
import * as schema from './schema'

export const sqliteDatabase = openDatabaseSync('onfoot.db')
export const db = drizzle(sqliteDatabase, { schema })
```

- [ ] **Step 5: Configure and generate migrations**

Create `drizzle.config.ts` (repo root):
```ts
import type { Config } from 'drizzle-kit'

export default {
  schema: './src/data/db/schema.ts',
  out: './src/data/db/migrations',
  dialect: 'sqlite',
  driver: 'expo',
} satisfies Config
```

Add to `package.json` scripts: `"db:generate": "drizzle-kit generate"`.

Run: `npm run db:generate`
Expected: creates `src/data/db/migrations/` with a `0000_*.sql` and a `migrations.js` (the Expo driver bundles SQL as a JS import — no Metro config needed). Verify the SQL contains `CREATE TABLE \`trails\``. (Confirm the drizzle-kit Expo flow against https://orm.drizzle.team/docs/get-started/expo-new if the output differs.)

- [ ] **Step 6: Write the SQLite repository**

Create `src/data/db/trailsRepository.ts`:
```ts
import { desc, eq } from 'drizzle-orm'
import { TrailsRepository } from '../trails/repository'
import { inputToInsertValues, rowToSummary, rowToTrail, TrailRow } from '../trails/mapping'
import { db } from './client'
import { trails } from './schema'

export const sqliteTrailsRepository: TrailsRepository = {
  async listSummaries() {
    const rows = await db.select().from(trails).orderBy(desc(trails.createdAt))
    return (rows as TrailRow[]).map(rowToSummary)
  },
  async getTrail(id) {
    const rows = await db.select().from(trails).where(eq(trails.id, id)).limit(1)
    return rows.length ? rowToTrail(rows[0] as TrailRow) : null
  },
  async createTrail(input) {
    const [inserted] = await db
      .insert(trails)
      .values(inputToInsertValues(input, Date.now()))
      .returning({ id: trails.id })
    return inserted.id
  },
  async deleteTrail(id) {
    await db.delete(trails).where(eq(trails.id, id))
  },
}
```

- [ ] **Step 7: Run migrations before the app renders**

Modify `app/_layout.tsx` to apply migrations and gate rendering on success. Replace its body with:
```tsx
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Text, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator'
import { db } from '../src/data/db/client'
import migrations from '../src/data/db/migrations/migrations'

export default function RootLayout() {
  const { success, error } = useMigrations(db, migrations)

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      {error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text>Database failed to initialize: {error.message}</Text>
        </View>
      ) : success ? (
        <Stack screenOptions={{ headerShown: false }} />
      ) : null}
    </GestureHandlerRootView>
  )
}
```
(Confirm the `useMigrations` import path and the generated `migrations` module path against the Drizzle Expo guide; adjust only those specifiers if the generated layout differs.)

- [ ] **Step 8: Rebuild and device-verify**

Run: `nix-shell --run "npx expo run:android"` (native rebuild — new native modules).
Verify on device SWWC4HEIYHZPQWZX: the app launches past the splash to the map (migrations succeeded → `success` true → `Stack` renders). No "Database failed to initialize" screen.

- [ ] **Step 9: Typecheck + commit**

Run: `npx tsc --noEmit`
```bash
git add package.json package-lock.json drizzle.config.ts src/data/db src/data/trails/repository.ts src/data/trails/index.ts app/_layout.tsx
git commit -m "feat: persistence seam — sqlite/drizzle trails repository + migrations"
```

---

### Task 5: Trails store (Zustand cache, TDD with a fake repository)

**Files:**
- Create: `src/store/trailsStore.ts`
- Test: `src/store/__tests__/trailsStore.test.ts`

**Interfaces:**
- Consumes: `trailsRepository`, `TrailSummary`, `NewTrailInput` from `src/data/trails`.
- Produces:
  ```ts
  interface TrailsStore {
    trails: TrailSummary[]
    loading: boolean
    loadTrails: () => Promise<void>
    addTrail: (input: NewTrailInput) => Promise<number>
    removeTrail: (id: number) => Promise<void>
  }
  export const useTrailsStore // Zustand hook
  ```

- [ ] **Step 1: Write the failing test**

`src/store/__tests__/trailsStore.test.ts`:
```ts
const fakeRepo = {
  listSummaries: jest.fn(),
  getTrail: jest.fn(),
  createTrail: jest.fn(),
  deleteTrail: jest.fn(),
}
jest.mock('../../data/trails', () => ({ trailsRepository: fakeRepo }))

import { useTrailsStore } from '../trailsStore'
import { NewTrailInput, TrailSummary } from '../../data/trails/types'

const summary = (id: number): TrailSummary => ({
  id, name: `T${id}`, difficulty: 'easy',
  metrics: { distanceMeters: 0, elevationGainMeters: 0, elevationLossMeters: 0 },
  createdAt: id,
})
const input: NewTrailInput = {
  name: 'New', difficulty: 'medium', description: null,
  metrics: { distanceMeters: 1, elevationGainMeters: 0, elevationLossMeters: 0 },
  geometry: { points: [], waypoints: [] },
}

beforeEach(() => {
  jest.clearAllMocks()
  useTrailsStore.setState({ trails: [], loading: false })
})

test('loadTrails caches summaries from the repository', async () => {
  fakeRepo.listSummaries.mockResolvedValue([summary(2), summary(1)])
  await useTrailsStore.getState().loadTrails()
  expect(useTrailsStore.getState().trails.map((t) => t.id)).toEqual([2, 1])
  expect(useTrailsStore.getState().loading).toBe(false)
})

test('addTrail creates via the repository, reloads, and returns the new id', async () => {
  fakeRepo.createTrail.mockResolvedValue(42)
  fakeRepo.listSummaries.mockResolvedValue([summary(42)])
  const id = await useTrailsStore.getState().addTrail(input)
  expect(id).toBe(42)
  expect(fakeRepo.createTrail).toHaveBeenCalledWith(input)
  expect(useTrailsStore.getState().trails.map((t) => t.id)).toEqual([42])
})

test('removeTrail deletes via the repository and drops it from the cache', async () => {
  useTrailsStore.setState({ trails: [summary(1), summary(2)] })
  fakeRepo.deleteTrail.mockResolvedValue(undefined)
  await useTrailsStore.getState().removeTrail(1)
  expect(fakeRepo.deleteTrail).toHaveBeenCalledWith(1)
  expect(useTrailsStore.getState().trails.map((t) => t.id)).toEqual([2])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/store/__tests__/trailsStore.test.ts`
Expected: FAIL — cannot find module `../trailsStore`.

- [ ] **Step 3: Write the implementation**

Create `src/store/trailsStore.ts`:
```ts
import { create } from 'zustand'
import { NewTrailInput, TrailSummary, trailsRepository } from '../data/trails'

interface TrailsStore {
  trails: TrailSummary[]
  loading: boolean
  loadTrails: () => Promise<void>
  addTrail: (input: NewTrailInput) => Promise<number>
  removeTrail: (id: number) => Promise<void>
}

export const useTrailsStore = create<TrailsStore>((set, get) => ({
  trails: [],
  loading: false,
  loadTrails: async () => {
    set({ loading: true })
    const trails = await trailsRepository.listSummaries()
    set({ trails, loading: false })
  },
  addTrail: async (input) => {
    const id = await trailsRepository.createTrail(input)
    await get().loadTrails()
    return id
  },
  removeTrail: async (id) => {
    await trailsRepository.deleteTrail(id)
    set((s) => ({ trails: s.trails.filter((t) => t.id !== id) }))
  },
}))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/store/__tests__/trailsStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit`
```bash
git add src/store/trailsStore.ts src/store/__tests__/trailsStore.test.ts
git commit -m "feat: trailsStore cache over the trails repository"
```

---

### Task 6: Difficulty helpers + presentational components

**Files:**
- Create: `src/trails/difficulty.ts`
- Test: `src/trails/__tests__/difficulty.test.ts`
- Create: `src/trails/DifficultyBadge.tsx`, `src/trails/MetricsRow.tsx`, `src/trails/TrailListItem.tsx`, `src/trails/DifficultySelector.tsx`
- Modify: `src/theme/colors.ts`, `src/theme/__tests__/colors.test.ts`

**Interfaces:**
- Consumes: `Difficulty`, `TrailSummary` from `src/data/trails/types`; `formatDistance`, `formatElevation` from `src/data/trails/gpx/metrics`; `AppColors` from `src/theme/colors`; `useTheme`.
- Produces:
  ```ts
  export const DIFFICULTIES: Difficulty[]                 // ['easy','medium','hard']
  export function difficultyLabel(d: Difficulty): string  // 'Easy' | 'Medium' | 'Hard'
  export function difficultyColor(d: Difficulty, colors: AppColors): string
  // Components:
  <DifficultyBadge difficulty={Difficulty} />
  <MetricsRow metrics={TrailMetrics} />
  <TrailListItem trail={TrailSummary} onDelete={(id:number)=>void} />
  <DifficultySelector value={Difficulty | null} onChange={(d:Difficulty)=>void} />
  ```

- [ ] **Step 1: Write the failing test for difficulty helpers + theme colors**

`src/trails/__tests__/difficulty.test.ts`:
```ts
import { DIFFICULTIES, difficultyLabel, difficultyColor } from '../difficulty'
import { lightColors } from '../../theme/colors'

test('DIFFICULTIES lists all three in ascending order', () => {
  expect(DIFFICULTIES).toEqual(['easy', 'medium', 'hard'])
})

test('difficultyLabel capitalizes each level', () => {
  expect(difficultyLabel('easy')).toBe('Easy')
  expect(difficultyLabel('medium')).toBe('Medium')
  expect(difficultyLabel('hard')).toBe('Hard')
})

test('difficultyColor maps each level to its theme color', () => {
  expect(difficultyColor('easy', lightColors)).toBe(lightColors.difficultyEasy)
  expect(difficultyColor('medium', lightColors)).toBe(lightColors.difficultyMedium)
  expect(difficultyColor('hard', lightColors)).toBe(lightColors.difficultyHard)
})
```

Append to `src/theme/__tests__/colors.test.ts`:
```ts
test('difficulty colors are defined in both themes', () => {
  for (const c of [lightColors, darkColors]) {
    expect(c.difficultyEasy).toMatch(/^#/)
    expect(c.difficultyMedium).toMatch(/^#/)
    expect(c.difficultyHard).toMatch(/^#/)
  }
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/trails/__tests__/difficulty.test.ts src/theme/__tests__/colors.test.ts`
Expected: FAIL — `../difficulty` missing and `difficultyEasy` undefined.

- [ ] **Step 3: Add theme colors**

In `src/theme/colors.ts`, add three fields to the `AppColors` interface and both palettes:
```ts
// in AppColors:
  difficultyEasy: string
  difficultyMedium: string
  difficultyHard: string
```
```ts
// in lightColors:
  difficultyEasy: '#2E7D32',
  difficultyMedium: '#F9A825',
  difficultyHard: '#C62828',
```
```ts
// in darkColors:
  difficultyEasy: '#66BB6A',
  difficultyMedium: '#FFB300',
  difficultyHard: '#EF5350',
```

- [ ] **Step 4: Write `difficulty.ts`**

Create `src/trails/difficulty.ts`:
```ts
import { Difficulty } from '../data/trails/types'
import { AppColors } from '../theme/colors'

export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard']

const LABELS: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }

export function difficultyLabel(difficulty: Difficulty): string {
  return LABELS[difficulty]
}

export function difficultyColor(difficulty: Difficulty, colors: AppColors): string {
  switch (difficulty) {
    case 'easy': return colors.difficultyEasy
    case 'medium': return colors.difficultyMedium
    case 'hard': return colors.difficultyHard
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest src/trails/__tests__/difficulty.test.ts src/theme/__tests__/colors.test.ts`
Expected: PASS.

- [ ] **Step 6: Write the presentational components**

Create `src/trails/DifficultyBadge.tsx`:
```tsx
import { Text } from 'react-native'
import { Difficulty } from '../data/trails/types'
import { useTheme } from '../theme/useTheme'
import { difficultyColor, difficultyLabel } from './difficulty'

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  const c = useTheme()
  return (
    <Text style={{ color: difficultyColor(difficulty, c), fontSize: 12, fontWeight: '600' }}>
      {difficultyLabel(difficulty)}
    </Text>
  )
}
```

Create `src/trails/MetricsRow.tsx`:
```tsx
import { StyleSheet, Text, View } from 'react-native'
import { TrailMetrics } from '../data/trails/types'
import { formatDistance, formatElevation } from '../data/trails/gpx/metrics'
import { useTheme } from '../theme/useTheme'

function MetricItem({ label, value, color, muted }: { label: string; value: string; color: string; muted: string }) {
  return (
    <View style={styles.item}>
      <Text style={[styles.value, { color }]}>{value}</Text>
      <Text style={[styles.label, { color: muted }]}>{label}</Text>
    </View>
  )
}

export function MetricsRow({ metrics }: { metrics: TrailMetrics }) {
  const c = useTheme()
  return (
    <View style={[styles.row, { backgroundColor: c.surface }]}>
      <MetricItem label="Distance" value={formatDistance(metrics.distanceMeters)} color={c.onSurface} muted={c.onSurfaceVariant} />
      <MetricItem label="Elevation Gain" value={formatElevation(metrics.elevationGainMeters)} color={c.onSurface} muted={c.onSurfaceVariant} />
      <MetricItem label="Elevation Loss" value={formatElevation(metrics.elevationLossMeters)} color={c.onSurface} muted={c.onSurfaceVariant} />
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-evenly', borderRadius: 12, padding: 16 },
  item: { alignItems: 'center' },
  value: { fontSize: 16, fontWeight: '700' },
  label: { fontSize: 12, marginTop: 2 },
})
```

Create `src/trails/TrailListItem.tsx`:
```tsx
import { Ionicons } from '@expo/vector-icons'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { TrailSummary } from '../data/trails/types'
import { formatDistance, formatElevation } from '../data/trails/gpx/metrics'
import { useTheme } from '../theme/useTheme'
import { DifficultyBadge } from './DifficultyBadge'

export function TrailListItem({ trail, onDelete }: { trail: TrailSummary; onDelete: (id: number) => void }) {
  const c = useTheme()
  return (
    <View style={[styles.card, { backgroundColor: c.surface }]}>
      <View style={[styles.thumb, { backgroundColor: c.background }]}>
        <Ionicons name="walk-outline" size={28} color={c.onSurfaceVariant} />
      </View>
      <View style={styles.info}>
        <Text style={[styles.name, { color: c.onSurface }]} numberOfLines={1}>{trail.name}</Text>
        <DifficultyBadge difficulty={trail.difficulty} />
        <Text style={[styles.metrics, { color: c.onSurfaceVariant }]}>
          {formatDistance(trail.metrics.distanceMeters)} • {formatElevation(trail.metrics.elevationGainMeters)} gain
        </Text>
      </View>
      <Pressable accessibilityLabel="Delete trail" onPress={() => onDelete(trail.id)} hitSlop={8} style={styles.delete}>
        <Ionicons name="trash-outline" size={22} color={c.difficultyHard} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 12, marginHorizontal: 16 },
  thumb: { width: 64, height: 64, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, marginLeft: 12, gap: 4 },
  name: { fontSize: 16, fontWeight: '700' },
  metrics: { fontSize: 13 },
  delete: { padding: 8 },
})
```

Create `src/trails/DifficultySelector.tsx`:
```tsx
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Difficulty } from '../data/trails/types'
import { useTheme } from '../theme/useTheme'
import { DIFFICULTIES, difficultyColor, difficultyLabel } from './difficulty'

export function DifficultySelector({ value, onChange }: { value: Difficulty | null; onChange: (d: Difficulty) => void }) {
  const c = useTheme()
  return (
    <View style={styles.row}>
      {DIFFICULTIES.map((d) => {
        const selected = d === value
        return (
          <Pressable
            key={d}
            accessibilityLabel={`Difficulty ${difficultyLabel(d)}`}
            onPress={() => onChange(d)}
            style={[
              styles.chip,
              { borderColor: difficultyColor(d, c), backgroundColor: selected ? difficultyColor(d, c) : 'transparent' },
            ]}
          >
            <Text style={{ color: selected ? c.surface : difficultyColor(d, c), fontWeight: '600' }}>
              {difficultyLabel(d)}
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

- [ ] **Step 7: Typecheck + commit**

Run: `npx tsc --noEmit` and `npx jest src/trails src/theme`
```bash
git add src/trails src/theme/colors.ts src/theme/__tests__/colors.test.ts
git commit -m "feat: difficulty helpers, theme colors, and trail presentational components"
```

---

### Task 7: Trails list screen (device-verified)

**Files:**
- Modify: `app/(tabs)/trails.tsx` (replace placeholder)

**Interfaces:**
- Consumes: `useTrailsStore`; `TrailListItem`; `useTheme`; expo-router `useFocusEffect`, `useRouter`; `useSafeAreaInsets`.
- Produces: the Trails tab screen. The bottom button navigates to `/trail/new` (route created in Task 8; until then it is defined and simply pushes — verify navigation after Task 8).

- [ ] **Step 1: Implement the screen**

Replace `app/(tabs)/trails.tsx` with:
```tsx
import { useCallback, useState } from 'react'
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { useTrailsStore } from '../../src/store/trailsStore'
import { TrailListItem } from '../../src/trails/TrailListItem'
import { useTheme } from '../../src/theme/useTheme'
import { TrailSummary } from '../../src/data/trails/types'

export default function TrailsScreen() {
  const c = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const trails = useTrailsStore((s) => s.trails)
  const loadTrails = useTrailsStore((s) => s.loadTrails)
  const removeTrail = useTrailsStore((s) => s.removeTrail)
  const [pending, setPending] = useState(false)

  useFocusEffect(useCallback(() => { loadTrails() }, [loadTrails]))

  const confirmDelete = useCallback(
    (trail: TrailSummary) => {
      Alert.alert(
        'Delete Trail',
        `Are you sure you want to delete "${trail.name}"? This action cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              setPending(true)
              try {
                await removeTrail(trail.id)
              } finally {
                setPending(false)
              }
            },
          },
        ],
      )
    },
    [removeTrail],
  )

  return (
    <View style={[styles.screen, { backgroundColor: c.background, paddingTop: insets.top }]}>
      <Text style={[styles.title, { color: c.onSurface }]}>Trails</Text>
      {trails.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ color: c.onSurfaceVariant, fontSize: 16 }}>No trails saved yet.</Text>
        </View>
      ) : (
        <FlatList
          data={trails}
          keyExtractor={(t) => String(t.id)}
          renderItem={({ item }) => <TrailListItem trail={item} onDelete={() => confirmDelete(item)} />}
          contentContainerStyle={styles.list}
        />
      )}
      <View style={{ padding: 16, paddingBottom: insets.bottom + 16 }}>
        <Pressable
          accessibilityLabel="Add a GPX file"
          disabled={pending}
          onPress={() => router.push('/trail/new')}
          style={[styles.addButton, { backgroundColor: c.controlAccent, opacity: pending ? 0.6 : 1 }]}
        >
          <Text style={[styles.addLabel, { color: c.surface }]}>Add a GPX file</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  title: { fontSize: 28, fontWeight: '700', paddingHorizontal: 16, paddingVertical: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { gap: 8, paddingVertical: 8 },
  addButton: { borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  addLabel: { fontSize: 16, fontWeight: '700' },
})
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean (the `/trail/new` typed route resolves once Task 8 creates the file; if run before Task 8, expect a typed-routes error on that string — proceed to Task 8, then re-check).

- [ ] **Step 3: Device-verify (Fast Refresh)**

Reload on device. Verify: the tab shows "Trails" + "No trails saved yet." + a full-width blue "Add a GPX file" button pinned above the tab bar, safe-area aware. (Tapping it is verified in Task 8.)

- [ ] **Step 4: Commit**

```bash
git add "app/(tabs)/trails.tsx"
git commit -m "feat: trails list screen with empty state, delete, and add button"
```

---

### Task 8: GPX file reader + Add-GPX form screen (device-verified)

**Files:**
- Create: `src/data/trails/gpx/readFile.ts`
- Create: `app/trail/new.tsx`

**Interfaces:**
- Consumes: `parseGpx`, `computeMetrics`, `readGpxFile`, `useTrailsStore`, `DifficultySelector`, `MetricsRow`, expo-router `useLocalSearchParams`/`useRouter`.
- Produces:
  ```ts
  // readFile.ts
  export function readGpxFile(uri: string): Promise<string>
  ```
  The form route reads params `{ uri: string; name?: string }`.

- [ ] **Step 1: Write the file reader**

Create `src/data/trails/gpx/readFile.ts`:
```ts
import * as FileSystem from 'expo-file-system'

export function readGpxFile(uri: string): Promise<string> {
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 })
}
```
(Confirm `readAsStringAsync`/`EncodingType` against the expo-file-system v57 docs; adjust only if the API name changed.)

- [ ] **Step 2: Implement the form screen**

Create `app/trail/new.tsx`:
```tsx
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { readGpxFile } from '../../src/data/trails/gpx/readFile'
import { parseGpx } from '../../src/data/trails/gpx/parse'
import { computeMetrics } from '../../src/data/trails/gpx/metrics'
import { useTrailsStore } from '../../src/store/trailsStore'
import { Difficulty, TrailGeometry, TrailMetrics } from '../../src/data/trails/types'
import { DifficultySelector } from '../../src/trails/DifficultySelector'
import { MetricsRow } from '../../src/trails/MetricsRow'
import { useTheme } from '../../src/theme/useTheme'

export default function TrailFormScreen() {
  const c = useTheme()
  const router = useRouter()
  const params = useLocalSearchParams<{ uri?: string; name?: string }>()
  const addTrail = useTrailsStore((s) => s.addTrail)

  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState<TrailMetrics | null>(null)
  const [geometry, setGeometry] = useState<TrailGeometry | null>(null)
  const [name, setName] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null)
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!params.uri) {
        router.back()
        return
      }
      try {
        const xml = await readGpxFile(params.uri)
        const parsed = parseGpx(xml, params.name ?? null)
        if (cancelled) return
        setGeometry({ points: parsed.points, waypoints: parsed.waypoints })
        setMetrics(computeMetrics(parsed.points))
        setName(parsed.title ?? params.name ?? '')
        setLoading(false)
      } catch {
        if (!cancelled) {
          setLoading(false)
          router.back()
        }
      }
    }
    run()
    return () => { cancelled = true }
  }, [params.uri, params.name, router])

  const canSave = name.trim().length > 0 && difficulty !== null && !saving

  const onSave = useCallback(async () => {
    if (!metrics || !geometry || difficulty === null) return
    setSaving(true)
    try {
      await addTrail({
        name: name.trim(),
        difficulty,
        description: description.trim().length > 0 ? description.trim() : null,
        metrics,
        geometry,
      })
      router.back()
    } finally {
      setSaving(false)
    }
  }, [addTrail, description, difficulty, geometry, metrics, name, router])

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'New Trail',
          headerLeft: () => (
            <Pressable accessibilityLabel="Back" onPress={() => router.back()} hitSlop={8}>
              <Ionicons name="arrow-back" size={24} color={c.onSurface} />
            </Pressable>
          ),
        }}
      />
      {loading || !metrics ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={c.controlAccent} />
        </View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <MetricsRow metrics={metrics} />

            <Text style={[styles.label, { color: c.onSurface }]}>Name *</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Trail name"
              placeholderTextColor={c.onSurfaceVariant}
              style={[styles.input, { color: c.onSurface, borderColor: c.panelDivider }]}
            />

            <Text style={[styles.label, { color: c.onSurface }]}>Difficulty *</Text>
            <DifficultySelector value={difficulty} onChange={setDifficulty} />

            <Text style={[styles.label, { color: c.onSurface }]}>Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Optional"
              placeholderTextColor={c.onSurfaceVariant}
              multiline
              style={[styles.input, styles.multiline, { color: c.onSurface, borderColor: c.panelDivider }]}
            />

            <Pressable
              accessibilityLabel="Save trail"
              disabled={!canSave}
              onPress={onSave}
              style={[styles.save, { backgroundColor: c.controlAccent, opacity: canSave ? 1 : 0.5 }]}
            >
              {saving ? <ActivityIndicator color={c.surface} /> : <Text style={[styles.saveLabel, { color: c.surface }]}>I'm done</Text>}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 12 },
  label: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 16 },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  save: { marginTop: 12, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  saveLabel: { fontSize: 16, fontWeight: '700' },
})
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean, and the Task 7 `/trail/new` route now resolves under typed routes.

- [ ] **Step 4: Device-verify with a bundled fixture (temporary)**

To exercise the form before the picker (Task 9) exists, temporarily change the list button to push a real device file URI, or use `adb push` a `.gpx` to the device and pass its `file://` path. Verify: spinner → metrics row populates → editing name/difficulty enables "I'm done" → save returns to the list → the trail appears. Revert any temporary URI hack before committing.

- [ ] **Step 5: Commit**

```bash
git add src/data/trails/gpx/readFile.ts app/trail/new.tsx
git commit -m "feat: add-GPX form screen + file reader (shared import path)"
```

---

### Task 9: Door A — document picker + navigate (device-verified)

**Files:**
- Modify: `app/(tabs)/trails.tsx` (wire the button to the picker)

**Interfaces:**
- Consumes: `expo-document-picker`; `useRouter`.
- Produces: button → picker → `router.push({ pathname: '/trail/new', params: { uri, name } })`.

- [ ] **Step 1: Wire the picker**

In `app/(tabs)/trails.tsx`, add the import and a handler, and point the button at it:
```tsx
import * as DocumentPicker from 'expo-document-picker'
```
```tsx
  const pickGpx = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/gpx+xml', 'application/octet-stream', 'application/xml', 'text/xml', '*/*'],
      copyToCacheDirectory: true,
    })
    if (result.canceled) return
    const asset = result.assets[0]
    const fallback = asset.name?.replace(/\.[^.]+$/, '')
    router.push({ pathname: '/trail/new', params: { uri: asset.uri, name: fallback ?? '' } })
  }, [router])
```
Change the button's `onPress={() => router.push('/trail/new')}` to `onPress={pickGpx}`.
(Confirm `getDocumentAsync`'s result shape — `canceled`/`assets` — against expo-document-picker v57 docs.)

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Device-verify (Fast Refresh — module already built in Task 4)**

Reload. Tap "Add a GPX file" → system picker opens → choose a real `.gpx` → routes to the form with metrics populated and name prefilled → save → trail listed. Test cancel: picker dismissed, no navigation.

- [ ] **Step 4: Commit**

```bash
git add "app/(tabs)/trails.tsx"
git commit -m "feat: Door A — pick a GPX file and open the add-trail form"
```

---

### Task 10: Door B — OS file-open association (device-verified, native rebuild)

**Files:**
- Modify: `app.config.ts` (Android intent filters)
- Modify: `app/_layout.tsx` (handle an incoming GPX URI → navigate)

**Interfaces:**
- Consumes: `expo-linking` (`useURL`/`getInitialURL`), `expo-router` `useRouter`.
- Produces: opening a `.gpx` from another app routes to `/trail/new` with the content URI.

- [ ] **Step 1: Declare Android intent filters**

In `app.config.ts`, inside `android`, add:
```ts
    intentFilters: [
      {
        action: "VIEW",
        category: ["DEFAULT", "BROWSABLE"],
        data: [
          { scheme: "content", mimeType: "application/gpx+xml" },
          { scheme: "content", mimeType: "application/octet-stream" },
          { scheme: "file", mimeType: "*/*", pathPattern: ".*\\.gpx" },
          { scheme: "content", mimeType: "*/*", pathPattern: ".*\\.gpx" },
        ],
      },
    ],
```
(Confirm the `intentFilters` schema for SDK 57 in the Expo Android config docs; keep the `application/gpx+xml` + `.gpx` pathPattern coverage.)

- [ ] **Step 2: Handle the incoming URI in the root layout**

In `app/_layout.tsx`, add a handler that routes a GPX open to the form. Add imports and, inside `RootLayout` (only meaningful once `success` is true), subscribe to the incoming URL:
```tsx
import { useEffect } from 'react'
import * as Linking from 'expo-linking'
import { router } from 'expo-router'

function useGpxOpenHandler(ready: boolean) {
  useEffect(() => {
    if (!ready) return
    const handle = (url: string | null) => {
      if (url && /\.gpx($|\?)/i.test(url)) {
        const name = decodeURIComponent(url.split('/').pop() ?? '').replace(/\.[^.]+$/, '')
        router.push({ pathname: '/trail/new', params: { uri: url, name } })
      }
    }
    Linking.getInitialURL().then(handle)
    const sub = Linking.addEventListener('url', (e) => handle(e.url))
    return () => sub.remove()
  }, [ready])
}
```
Call `useGpxOpenHandler(success)` inside `RootLayout` before the return. (Some Android content URIs won't end in `.gpx`; the filter already scoped the intent to GPX, so if testing surfaces a non-`.gpx` content URI, relax the guard to also accept the `content://` scheme. Verify on-device and adjust the predicate accordingly.)

- [ ] **Step 3: Rebuild and device-verify**

Run: `nix-shell --run "npx expo run:android"` (app.config change → native rebuild).
Verify: from a file manager / email attachment, "Open with" → On Foot → the app launches into the add-trail form with the file's metrics; save → trail listed. Also test warm-start (app already open) via the `url` event.

- [ ] **Step 4: Commit**

```bash
git add app.config.ts app/_layout.tsx
git commit -m "feat: Door B — open GPX files with the app into the add-trail form"
```

---

## Verification (whole slice)

- `npx tsc --noEmit` clean.
- `npx jest` green — new suites (metrics, parse, mapping, trailsStore, difficulty, colors) alongside the existing 57.
- Device (SWWC4HEIYHZPQWZX): app boots (migrations applied); Trails tab shows empty state + button; Door A picker → form → save → list; delete with confirmation; Door B "open with" → form → save (after rebuild).
- Seam audit: `grep -rn "expo-sqlite\|drizzle-orm" src` shows imports only under `src/data/db/`. Store/UI import only `src/data/trails` (port + types).

## Notes on deferred work (do not build here)

Photos (picker/storage/thumbnails), edit mode, card-tap "show on map", the map trail overlay + camera-fit, and waypoint rendering are later slices. The `geometry` column already persists the polyline for the map slice; new columns/tables arrive via `npm run db:generate` migrations.
