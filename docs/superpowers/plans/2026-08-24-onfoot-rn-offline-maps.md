# Offline Maps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a hiker download a trail's map tiles (per selected layer) for offline use, with live progress, a Settings management surface, and safe per-layer removal.

**Architecture:** Offline is a semantic controller on the map-provider port (`OfflineController`), implemented only in the mapbox adapter over `@rnmapbox/maps` `offlineManager`. A trail is the atomic unit: one pack per `(trail × layer)`, named deterministically, with `{trailId, styleId}` in pack metadata. The Mapbox pack registry is the source of truth — no new SQLite table; live progress lives in a session-only Zustand store. Pure helpers (pack id, bounds, size estimate, grouping, badge state) are TDD'd; the controller, chooser sheet, sheet badge, and Settings screen are device-verified.

**Tech Stack:** Expo SDK 57, React Native, TypeScript, Zustand, `@rnmapbox/maps` 10.3.5 (`offlineManager`), `@gorhom/bottom-sheet`, Expo Router, Jest.

## Global Constraints

- **Map-provider seam is inviolable:** only `src/map/providers/mapbox/` imports `@rnmapbox/maps`. All shared code uses the `OfflineController` port in `src/map/provider/types.ts`. No provider style ids or SDK types leak into shared code.
- **Leaf-not-barrel imports:** pure/offline code imports domain types from `src/data/trails/types` (leaf), NEVER `src/data/trails` (barrel — it opens the DB via `openDatabaseSync`).
- **Persist the minimum:** no new SQLite table/migration. Offline state derives from `OfflineController.listPacks()`; live progress is a session-only store (not persisted).
- **Pure logic is TDD'd; native rendering/gestures/camera/SDK are device-verified,** not unit-tested. Tests live in `src/**/__tests__/`.
- **Pack naming is canonical:** `offline:<trailId>:<styleId>` via `packId`/`parsePackId`. Every consumer uses these — no ad-hoc string building.
- **Fixed offline zoom range** `OFFLINE_MIN_ZOOM=10`, `OFFLINE_MAX_ZOOM=16`; bbox margin `OFFLINE_MARGIN_KM=2`. Never user-facing knobs.
- **Sizes are heuristic estimates** (tile-count × bytes-per-tile); label them as estimates in UI; show actual size for downloaded packs.
- **Comments describe current state only, sparingly.** No quick-fixes; fix at the right layer.
- **Verify on device SWWC4HEIYHZPQWZX** (user's manual step) for every device-verified task.
- **Layers are equal peers:** the chooser lists all `capabilities.styles`; a layer's `satellite` flag maps to raster (larger) vs vector for sizing. New sources append with no special-casing.
- **Deferred, do NOT build:** download-an-area ("Areas — LATER" placeholder only), coverage-derived badges, non-Mapbox layer sources, a WiFi-only setting, tile staleness/auto-update.

---

## File Structure

**Created:**
- `src/map/offline/types.ts` — offline view-model types (`LngLatBounds`, `LayerKind`, `SizeEstimate`, `OfflineLayerRow`, `OfflineTrailGroup`, `OfflineBadgeState`, `LiveProgress`).
- `src/map/offline/constants.ts` — zoom range, margin, bytes-per-tile, tile-count warn threshold.
- `src/map/offline/packId.ts` — `packId` / `parsePackId`.
- `src/map/offline/bounds.ts` — `boundsForTrail`.
- `src/map/offline/estimate.ts` — `lngToTileX`/`latToTileY`/`tileCountForBounds`/`estimatePackSize`/`layerKindForStyle`.
- `src/map/offline/grouping.ts` — `groupPacksByTrail` / `totalOfflineBytes`.
- `src/map/offline/badge.ts` — `offlineStateForTrail`.
- `src/map/offline/operations.ts` — `packIdsForTrail` / `removeAllPacksForTrail`.
- `src/map/offline/offlineStore.ts` — session-only Zustand store (packs cache + live progress).
- `src/map/offline/OfflineLayerChooser.tsx` — the layer chooser bottom-sheet modal.
- `src/map/offline/OfflineActionsMenu.tsx` — the ⋮ overflow popover.
- `src/map/offline/OfflineMapsList.tsx` — the Settings list (grouped by trail).
- `src/map/providers/mapbox/offline.ts` — mapbox `OfflineController` implementation + `mapPackState`.
- `app/settings/offline.tsx` — the "Offline maps" screen route.
- Tests: `src/map/offline/__tests__/{packId,bounds,estimate,grouping,badge,operations,offlineStore}.test.ts`, `src/map/providers/mapbox/__tests__/offline.test.ts`.

**Modified:**
- `src/map/provider/types.ts` — add `OfflinePackDescriptor`, `OfflinePackInfo`, `OfflineController`; add `offline: OfflineController` to `MapProvider`.
- `src/map/provider/MapProviderContext.tsx` — add `useOfflineController`.
- `src/map/providers/mapbox/adapter.tsx` — add `offline` to `mapboxProvider`.
- `src/trails/TrailInfoSheet.tsx` — offline badge, progress line, ⋮ menu, open chooser.
- `app/_layout.tsx` — hoist `MapProviderProvider` + `BottomSheetModalProvider` to root.
- `src/map/MapScreen.tsx` — drop the now-hoisted providers.
- `app/(tabs)/settings.tsx` — add "Offline maps" navigation row.
- `app/(tabs)/trails.tsx` — cascade-delete offline packs on trail delete.

---

### Task 1: Pure helpers — pack id + bounds

**Files:**
- Create: `src/map/offline/types.ts`
- Create: `src/map/offline/packId.ts`
- Create: `src/map/offline/bounds.ts`
- Test: `src/map/offline/__tests__/packId.test.ts`, `src/map/offline/__tests__/bounds.test.ts`

**Interfaces:**
- Produces: `packId(trailId: number, styleId: string): string`; `parsePackId(id: string): { trailId: number; styleId: string } | null`; `boundsForTrail(points: { lat: number; lng: number }[], marginKm: number): LngLatBounds | null`; type `LngLatBounds = { ne: [number, number]; sw: [number, number] }` (each `[lng, lat]`).

- [ ] **Step 1: Write the failing tests**

`src/map/offline/__tests__/packId.test.ts`:
```ts
import { packId, parsePackId } from '../packId'

describe('packId / parsePackId', () => {
  test('builds the canonical name', () => {
    expect(packId(7, 'outdoors')).toBe('offline:7:outdoors')
  })
  test('round-trips', () => {
    expect(parsePackId(packId(42, 'satellite'))).toEqual({ trailId: 42, styleId: 'satellite' })
  })
  test('preserves style ids containing colons/hyphens', () => {
    const id = packId(3, 'mapbox:custom-v2')
    expect(parsePackId(id)).toEqual({ trailId: 3, styleId: 'mapbox:custom-v2' })
  })
  test('returns null for a foreign or malformed name', () => {
    expect(parsePackId('some-other-pack')).toBeNull()
    expect(parsePackId('offline:notanumber:x')).toBeNull()
    expect(parsePackId('offline:5')).toBeNull()
  })
})
```

`src/map/offline/__tests__/bounds.test.ts`:
```ts
import { boundsForTrail } from '../bounds'

describe('boundsForTrail', () => {
  test('returns null for no points', () => {
    expect(boundsForTrail([], 2)).toBeNull()
  })
  test('a single point becomes a margin-sized box centred on it', () => {
    const b = boundsForTrail([{ lat: 0, lng: 0 }], 111)!
    // ~111 km ≈ 1° of latitude
    expect(b.ne[1]).toBeCloseTo(1, 1)
    expect(b.sw[1]).toBeCloseTo(-1, 1)
    expect(b.ne[0]).toBeGreaterThan(0)
    expect(b.sw[0]).toBeLessThan(0)
  })
  test('spans all points then expands by the margin', () => {
    const b = boundsForTrail(
      [{ lat: 10, lng: 20 }, { lat: 12, lng: 25 }],
      0,
    )!
    expect(b.ne).toEqual([25, 12])
    expect(b.sw).toEqual([20, 10])
  })
  test('ne is north-east, sw is south-west', () => {
    const b = boundsForTrail([{ lat: 5, lng: 5 }, { lat: -5, lng: -5 }], 1)!
    expect(b.ne[0]).toBeGreaterThan(b.sw[0])
    expect(b.ne[1]).toBeGreaterThan(b.sw[1])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/map/offline/__tests__/packId.test.ts src/map/offline/__tests__/bounds.test.ts`
Expected: FAIL — cannot find `../packId` / `../bounds`.

- [ ] **Step 3: Write the implementations**

`src/map/offline/types.ts`:
```ts
export type LngLatBounds = { ne: [number, number]; sw: [number, number] }

export type LayerKind = 'vector' | 'raster'

export interface SizeEstimate {
  bytes: number
  tileCount: number
}

export interface OfflineLayerRow {
  styleId: string
  sizeBytes: number
}

export interface OfflineTrailGroup {
  trailId: number
  trailName: string | null
  layers: OfflineLayerRow[]
  totalBytes: number
}

export type OfflineBadgeState =
  | { kind: 'none' }
  | { kind: 'downloading'; pct: number }
  | { kind: 'available'; styleIds: string[] }
  | { kind: 'failed' }

export interface LiveProgress {
  percentage: number
  failed: boolean
}
```

`src/map/offline/packId.ts`:
```ts
const PREFIX = 'offline'

export function packId(trailId: number, styleId: string): string {
  return `${PREFIX}:${trailId}:${styleId}`
}

export function parsePackId(id: string): { trailId: number; styleId: string } | null {
  const parts = id.split(':')
  if (parts.length < 3 || parts[0] !== PREFIX) return null
  const trailId = Number(parts[1])
  if (!Number.isInteger(trailId)) return null
  const styleId = parts.slice(2).join(':')
  if (styleId.length === 0) return null
  return { trailId, styleId }
}
```

`src/map/offline/bounds.ts`:
```ts
import { LngLatBounds } from './types'

const KM_PER_LAT_DEGREE = 111

export function boundsForTrail(
  points: { lat: number; lng: number }[],
  marginKm: number,
): LngLatBounds | null {
  if (points.length === 0) return null
  let minLat = points[0].lat
  let maxLat = points[0].lat
  let minLng = points[0].lng
  let maxLng = points[0].lng
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat
    if (p.lat > maxLat) maxLat = p.lat
    if (p.lng < minLng) minLng = p.lng
    if (p.lng > maxLng) maxLng = p.lng
  }
  const latMargin = marginKm / KM_PER_LAT_DEGREE
  const midLat = (minLat + maxLat) / 2
  const lngMargin = marginKm / (KM_PER_LAT_DEGREE * Math.max(0.01, Math.cos((midLat * Math.PI) / 180)))
  return {
    ne: [maxLng + lngMargin, maxLat + latMargin],
    sw: [minLng - lngMargin, minLat - latMargin],
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/map/offline/__tests__/packId.test.ts src/map/offline/__tests__/bounds.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/map/offline/types.ts src/map/offline/packId.ts src/map/offline/bounds.ts src/map/offline/__tests__/packId.test.ts src/map/offline/__tests__/bounds.test.ts
git commit -m "feat(offline): pure pack-id + trail-bounds helpers"
```

---

### Task 2: Pure helper — size estimate + constants

**Files:**
- Create: `src/map/offline/constants.ts`
- Create: `src/map/offline/estimate.ts`
- Test: `src/map/offline/__tests__/estimate.test.ts`

**Interfaces:**
- Consumes: `LngLatBounds`, `LayerKind`, `SizeEstimate` from `./types` (Task 1).
- Produces: `lngToTileX(lng, z)`, `latToTileY(lat, z)`, `tileCountForBounds(bounds, minZoom, maxZoom): number`, `estimatePackSize(bounds, minZoom, maxZoom, layerKind): SizeEstimate`, `layerKindForStyle(satellite?: boolean): LayerKind`. Constants `OFFLINE_MIN_ZOOM`, `OFFLINE_MAX_ZOOM`, `OFFLINE_MARGIN_KM`, `VECTOR_BYTES_PER_TILE`, `RASTER_BYTES_PER_TILE`, `TILE_COUNT_WARN_THRESHOLD`.

- [ ] **Step 1: Write the failing test**

`src/map/offline/__tests__/estimate.test.ts`:
```ts
import {
  lngToTileX,
  latToTileY,
  tileCountForBounds,
  estimatePackSize,
  layerKindForStyle,
} from '../estimate'
import { RASTER_BYTES_PER_TILE, VECTOR_BYTES_PER_TILE } from '../constants'
import { LngLatBounds } from '../types'

const world: LngLatBounds = { ne: [179, 85], sw: [-179, -85] }
const tiny: LngLatBounds = { ne: [0.001, 0.001], sw: [-0.001, -0.001] }

describe('slippy-map tile math', () => {
  test('zoom 0 is a single tile', () => {
    expect(lngToTileX(0, 0)).toBe(0)
    expect(latToTileY(0, 0)).toBe(0)
    expect(tileCountForBounds(world, 0, 0)).toBe(1)
  })
  test('a sub-tile bbox is one tile at a high zoom', () => {
    expect(tileCountForBounds(tiny, 14, 14)).toBe(1)
  })
  test('tile count grows with the zoom range', () => {
    const narrow = tileCountForBounds(tiny, 10, 12)
    const wide = tileCountForBounds(tiny, 10, 16)
    expect(wide).toBeGreaterThan(narrow)
  })
})

describe('estimatePackSize', () => {
  test('bytes = tileCount × per-tile constant for the layer kind', () => {
    const vector = estimatePackSize(tiny, 10, 16, 'vector')
    expect(vector.bytes).toBe(vector.tileCount * VECTOR_BYTES_PER_TILE)
  })
  test('raster (satellite) estimates larger than vector for the same area', () => {
    const v = estimatePackSize(tiny, 10, 16, 'vector')
    const r = estimatePackSize(tiny, 10, 16, 'raster')
    expect(r.bytes).toBeGreaterThan(v.bytes)
    expect(r.bytes).toBe(r.tileCount * RASTER_BYTES_PER_TILE)
  })
})

describe('layerKindForStyle', () => {
  test('satellite flag → raster', () => expect(layerKindForStyle(true)).toBe('raster'))
  test('absent/false → vector', () => {
    expect(layerKindForStyle(false)).toBe('vector')
    expect(layerKindForStyle(undefined)).toBe('vector')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/map/offline/__tests__/estimate.test.ts`
Expected: FAIL — cannot find `../estimate` / `../constants`.

- [ ] **Step 3: Write the implementation**

`src/map/offline/constants.ts`:
```ts
export const OFFLINE_MIN_ZOOM = 10
export const OFFLINE_MAX_ZOOM = 16
export const OFFLINE_MARGIN_KM = 2

// Heuristic average compressed bytes per tile. Vector tiles are small; raster
// (satellite) imagery tiles are much larger. Used only for pre-download estimates.
export const VECTOR_BYTES_PER_TILE = 25_000
export const RASTER_BYTES_PER_TILE = 90_000

// Mapbox's default per-device offline tile limit under the standard ToS. A requested
// pack estimated above this is warned about before download.
export const TILE_COUNT_WARN_THRESHOLD = 6000
```

`src/map/offline/estimate.ts`:
```ts
import { LayerKind, LngLatBounds, SizeEstimate } from './types'
import { RASTER_BYTES_PER_TILE, VECTOR_BYTES_PER_TILE } from './constants'

export function lngToTileX(lng: number, z: number): number {
  return Math.floor(((lng + 180) / 360) * 2 ** z)
}

export function latToTileY(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z)
}

export function tileCountForBounds(bounds: LngLatBounds, minZoom: number, maxZoom: number): number {
  let count = 0
  for (let z = minZoom; z <= maxZoom; z++) {
    const xMin = lngToTileX(bounds.sw[0], z)
    const xMax = lngToTileX(bounds.ne[0], z)
    // North latitude maps to a smaller tile-Y than south, so ne[1] gives the min row.
    const yMin = latToTileY(bounds.ne[1], z)
    const yMax = latToTileY(bounds.sw[1], z)
    count += (Math.abs(xMax - xMin) + 1) * (Math.abs(yMax - yMin) + 1)
  }
  return count
}

export function estimatePackSize(
  bounds: LngLatBounds,
  minZoom: number,
  maxZoom: number,
  layerKind: LayerKind,
): SizeEstimate {
  const tileCount = tileCountForBounds(bounds, minZoom, maxZoom)
  const bytesPerTile = layerKind === 'raster' ? RASTER_BYTES_PER_TILE : VECTOR_BYTES_PER_TILE
  return { tileCount, bytes: tileCount * bytesPerTile }
}

export function layerKindForStyle(satellite?: boolean): LayerKind {
  return satellite ? 'raster' : 'vector'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/map/offline/__tests__/estimate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/map/offline/constants.ts src/map/offline/estimate.ts src/map/offline/__tests__/estimate.test.ts
git commit -m "feat(offline): heuristic pack size estimator + tile math"
```

---

### Task 3: Provider port — OfflineController + mapbox adapter

**Files:**
- Modify: `src/map/provider/types.ts` (add offline types + `offline` on `MapProvider`)
- Modify: `src/map/provider/MapProviderContext.tsx` (add `useOfflineController`)
- Create: `src/map/providers/mapbox/offline.ts`
- Modify: `src/map/providers/mapbox/adapter.tsx` (wire `offline` into `mapboxProvider`)
- Test: `src/map/providers/mapbox/__tests__/offline.test.ts` (pure `mapPackState` only)

**Interfaces:**
- Consumes: nothing from prior tasks (types are self-contained here).
- Produces (port): `OfflinePackDescriptor`, `OfflinePackInfo`, `OfflineController`; `MapProvider.offline: OfflineController`; `useOfflineController(): OfflineController`. `mapPackState(state: number, percentage: number): OfflinePackInfo['state']`.

**Notes for the implementer:**
- Only this task's mapbox file may import `@rnmapbox/maps`. Everything else uses the port.
- `Mapbox.offlineManager.createPack(options, progressListener, errorListener)` requires `bounds: [[neLng,neLat],[swLng,swLat]]`, `name`, `styleURL`, `minZoom`, `maxZoom`, `metadata`. `getPacks()` returns `OfflinePack[]` with `.name`, `.metadata` (getter returns the decoded object), and async `.status()` → `{ state, percentage, completedTileSize }`. `deletePack(name)`, `getPack(name)`, `pack.resume()`, `offlineManager.subscribe(name, progressListener, errorListener)` / `unsubscribe(name)`.
- **Verify against `node_modules/@rnmapbox/maps` v10.3.5** the numeric values of the pack download state (documented: `0` inactive, `1` active, `2` complete). `mapPackState` treats `percentage >= 100` OR `state === 2` as `complete`, `state === 1` as `downloading`, else `incomplete`; the error state is delivered via the error listener, not `status`, so `listPacks` never returns `'error'` on its own — the store records failures from the error callback.

- [ ] **Step 1: Write the failing test (pure state mapping)**

`src/map/providers/mapbox/__tests__/offline.test.ts`:
```ts
import { mapPackState } from '../offline'

describe('mapPackState', () => {
  test('state 2 → complete', () => expect(mapPackState(2, 50)).toBe('complete'))
  test('100% → complete regardless of state', () => expect(mapPackState(1, 100)).toBe('complete'))
  test('active + partial → downloading', () => expect(mapPackState(1, 40)).toBe('downloading'))
  test('inactive + partial → incomplete', () => expect(mapPackState(0, 40)).toBe('incomplete'))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/map/providers/mapbox/__tests__/offline.test.ts`
Expected: FAIL — cannot find `../offline`.

- [ ] **Step 3: Add the port types**

In `src/map/provider/types.ts`, add above `MapProvider`:
```ts
export interface OfflinePackDescriptor {
  // Canonical pack name `offline:<trailId>:<styleId>`.
  id: string
  styleUrl: string
  // [ne, sw], each [lng, lat].
  bounds: [[number, number], [number, number]]
  minZoom: number
  maxZoom: number
  meta: { trailId: number; styleId: string }
}

export interface OfflinePackInfo {
  id: string
  meta: { trailId: number; styleId: string } | null
  state: 'complete' | 'downloading' | 'incomplete' | 'error'
  percentage: number
  sizeBytes: number
}

// The offline seam: download/manage per-region tile packs. Implemented only by the
// map adapter; shared code talks to this interface. The capability flag `offline`
// gates whether it is meaningful for a given provider.
export interface OfflineController {
  downloadPack(descriptor: OfflinePackDescriptor): Promise<void>
  deletePack(id: string): Promise<void>
  resumePack(id: string): Promise<void>
  listPacks(): Promise<OfflinePackInfo[]>
  // Observe an in-flight pack; returns an unsubscribe fn.
  subscribe(
    id: string,
    onProgress: (info: OfflinePackInfo) => void,
    onError: (id: string, message: string) => void,
  ): () => void
}
```
Then add `offline` to the `MapProvider` interface:
```ts
export interface MapProvider {
  capabilities: MapCapabilities
  components: MapComponents
  offline: OfflineController
}
```

- [ ] **Step 4: Add the context hook**

In `src/map/provider/MapProviderContext.tsx`, add the import of `OfflineController` to the existing type import and append:
```ts
export function useOfflineController(): OfflineController {
  return useMapProvider().offline
}
```

- [ ] **Step 5: Implement the mapbox adapter**

`src/map/providers/mapbox/offline.ts`:
```ts
import Mapbox from '@rnmapbox/maps'
import type { OfflineController, OfflinePackDescriptor, OfflinePackInfo } from '../../provider/types'

export function mapPackState(state: number, percentage: number): OfflinePackInfo['state'] {
  if (state === 2 || percentage >= 100) return 'complete'
  if (state === 1) return 'downloading'
  return 'incomplete'
}

function toMeta(raw: unknown): OfflinePackInfo['meta'] {
  const m = raw as { trailId?: unknown; styleId?: unknown } | null | undefined
  return m && typeof m.trailId === 'number' && typeof m.styleId === 'string'
    ? { trailId: m.trailId, styleId: m.styleId }
    : null
}

async function infoFromPack(pack: Mapbox.OfflinePack): Promise<OfflinePackInfo> {
  const status = await pack.status()
  return {
    id: pack.name,
    meta: toMeta(pack.metadata),
    state: mapPackState(status.state, status.percentage),
    percentage: status.percentage,
    sizeBytes: status.completedTileSize ?? 0,
  }
}

export const mapboxOfflineController: OfflineController = {
  async downloadPack(d: OfflinePackDescriptor) {
    await Mapbox.offlineManager.createPack(
      {
        name: d.id,
        styleURL: d.styleUrl,
        bounds: d.bounds,
        minZoom: d.minZoom,
        maxZoom: d.maxZoom,
        metadata: d.meta,
      },
      () => {},
      () => {},
    )
  },
  async deletePack(id: string) {
    await Mapbox.offlineManager.deletePack(id)
  },
  async resumePack(id: string) {
    const pack = await Mapbox.offlineManager.getPack(id)
    await pack?.resume()
  },
  async listPacks() {
    const packs = await Mapbox.offlineManager.getPacks()
    return Promise.all(packs.map(infoFromPack))
  },
  subscribe(id, onProgress, onError) {
    Mapbox.offlineManager.subscribe(
      id,
      (_pack, status) =>
        onProgress({
          id,
          meta: null,
          state: mapPackState(status.state, status.percentage),
          percentage: status.percentage,
          sizeBytes: status.completedTileSize ?? 0,
        }),
      (_pack, err) => onError(id, err.message),
    )
    return () => Mapbox.offlineManager.unsubscribe(id)
  },
}
```

- [ ] **Step 6: Wire into the provider**

In `src/map/providers/mapbox/adapter.tsx`, import the controller and add it to the export:
```ts
import { mapboxOfflineController } from './offline'
// ...
export const mapboxProvider: MapProvider = {
  capabilities: mapboxCapabilities,
  components: { View, Camera, Terrain, UserPuck, TrailOverlay, RouteLine },
  offline: mapboxOfflineController,
}
```

- [ ] **Step 7: Run test + typecheck**

Run: `npx jest src/map/providers/mapbox/__tests__/offline.test.ts && npx tsc --noEmit`
Expected: test PASS; tsc clean. (If `Mapbox.OfflinePack` is not a usable type, type the `infoFromPack` param as `Awaited<ReturnType<typeof Mapbox.offlineManager.getPacks>>[number]` instead.)

- [ ] **Step 8: Commit**

```bash
git add src/map/provider/types.ts src/map/provider/MapProviderContext.tsx src/map/providers/mapbox/offline.ts src/map/providers/mapbox/adapter.tsx src/map/providers/mapbox/__tests__/offline.test.ts
git commit -m "feat(offline): OfflineController port + mapbox adapter"
```

---

### Task 4: Pure helpers — grouping + badge state

**Files:**
- Create: `src/map/offline/grouping.ts`
- Create: `src/map/offline/badge.ts`
- Test: `src/map/offline/__tests__/grouping.test.ts`, `src/map/offline/__tests__/badge.test.ts`

**Interfaces:**
- Consumes: `OfflinePackInfo` from `../provider/types` (Task 3); `parsePackId` (Task 1); `OfflineTrailGroup`, `OfflineBadgeState`, `LiveProgress` from `./types`.
- Produces: `groupPacksByTrail(packs: OfflinePackInfo[], trails: { id: number; name: string }[]): OfflineTrailGroup[]`; `totalOfflineBytes(packs: OfflinePackInfo[]): number`; `offlineStateForTrail(trailId: number, packs: OfflinePackInfo[], progress: Record<string, LiveProgress>): OfflineBadgeState`.

- [ ] **Step 1: Write the failing tests**

`src/map/offline/__tests__/grouping.test.ts`:
```ts
import { groupPacksByTrail, totalOfflineBytes } from '../grouping'
import { packId } from '../packId'
import type { OfflinePackInfo } from '../../provider/types'

const pack = (trailId: number, styleId: string, sizeBytes: number): OfflinePackInfo => ({
  id: packId(trailId, styleId),
  meta: { trailId, styleId },
  state: 'complete',
  percentage: 100,
  sizeBytes,
})

describe('groupPacksByTrail', () => {
  test('groups a trail\'s layers with a per-group total', () => {
    const groups = groupPacksByTrail(
      [pack(1, 'outdoors', 45), pack(1, 'satellite', 375)],
      [{ id: 1, name: 'Lac Blanc' }],
    )
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ trailId: 1, trailName: 'Lac Blanc', totalBytes: 420 })
    expect(groups[0].layers).toEqual([
      { styleId: 'outdoors', sizeBytes: 45 },
      { styleId: 'satellite', sizeBytes: 375 },
    ])
  })
  test('a pack whose trail is gone groups under a null name', () => {
    const groups = groupPacksByTrail([pack(9, 'outdoors', 10)], [])
    expect(groups[0]).toMatchObject({ trailId: 9, trailName: null })
  })
  test('skips foreign (unparseable) pack names', () => {
    const foreign: OfflinePackInfo = { id: 'x', meta: null, state: 'complete', percentage: 100, sizeBytes: 5 }
    expect(groupPacksByTrail([foreign], [])).toEqual([])
  })
  test('empty → []', () => expect(groupPacksByTrail([], [])).toEqual([]))
})

describe('totalOfflineBytes', () => {
  test('sums all pack sizes', () => {
    expect(totalOfflineBytes([pack(1, 'a', 10), pack(2, 'b', 32)])).toBe(42)
  })
})
```

`src/map/offline/__tests__/badge.test.ts`:
```ts
import { offlineStateForTrail } from '../badge'
import { packId } from '../packId'
import type { OfflinePackInfo } from '../../provider/types'

const complete = (trailId: number, styleId: string): OfflinePackInfo => ({
  id: packId(trailId, styleId), meta: { trailId, styleId }, state: 'complete', percentage: 100, sizeBytes: 1,
})

describe('offlineStateForTrail', () => {
  test('no packs, no progress → none', () => {
    expect(offlineStateForTrail(1, [], {})).toEqual({ kind: 'none' })
  })
  test('complete packs → available with their style ids', () => {
    const state = offlineStateForTrail(1, [complete(1, 'outdoors'), complete(1, 'satellite')], {})
    expect(state).toEqual({ kind: 'available', styleIds: ['outdoors', 'satellite'] })
  })
  test('live progress for the trail → downloading with rounded average pct', () => {
    const state = offlineStateForTrail(1, [], {
      [packId(1, 'outdoors')]: { percentage: 40, failed: false },
      [packId(1, 'satellite')]: { percentage: 60, failed: false },
    })
    expect(state).toEqual({ kind: 'downloading', pct: 50 })
  })
  test('a failed live entry → failed (beats available)', () => {
    const state = offlineStateForTrail(1, [complete(1, 'outdoors')], {
      [packId(1, 'satellite')]: { percentage: 10, failed: true },
    })
    expect(state).toEqual({ kind: 'failed' })
  })
  test('a pack in error state → failed', () => {
    const errored: OfflinePackInfo = { id: packId(1, 'x'), meta: { trailId: 1, styleId: 'x' }, state: 'error', percentage: 5, sizeBytes: 0 }
    expect(offlineStateForTrail(1, [errored], {})).toEqual({ kind: 'failed' })
  })
  test('ignores other trails', () => {
    expect(offlineStateForTrail(2, [complete(1, 'outdoors')], {})).toEqual({ kind: 'none' })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/map/offline/__tests__/grouping.test.ts src/map/offline/__tests__/badge.test.ts`
Expected: FAIL — cannot find `../grouping` / `../badge`.

- [ ] **Step 3: Write the implementations**

`src/map/offline/grouping.ts`:
```ts
import type { OfflinePackInfo } from '../provider/types'
import { parsePackId } from './packId'
import { OfflineLayerRow, OfflineTrailGroup } from './types'

export function groupPacksByTrail(
  packs: OfflinePackInfo[],
  trails: { id: number; name: string }[],
): OfflineTrailGroup[] {
  const byTrail = new Map<number, OfflineLayerRow[]>()
  for (const p of packs) {
    const parsed = parsePackId(p.id)
    if (!parsed) continue
    const rows = byTrail.get(parsed.trailId) ?? []
    rows.push({ styleId: parsed.styleId, sizeBytes: p.sizeBytes })
    byTrail.set(parsed.trailId, rows)
  }
  const nameOf = new Map(trails.map((t) => [t.id, t.name]))
  return [...byTrail.entries()].map(([trailId, layers]) => ({
    trailId,
    trailName: nameOf.get(trailId) ?? null,
    layers,
    totalBytes: layers.reduce((sum, l) => sum + l.sizeBytes, 0),
  }))
}

export function totalOfflineBytes(packs: OfflinePackInfo[]): number {
  return packs.reduce((sum, p) => sum + p.sizeBytes, 0)
}
```

`src/map/offline/badge.ts`:
```ts
import type { OfflinePackInfo } from '../provider/types'
import { parsePackId } from './packId'
import { LiveProgress, OfflineBadgeState } from './types'

export function offlineStateForTrail(
  trailId: number,
  packs: OfflinePackInfo[],
  progress: Record<string, LiveProgress>,
): OfflineBadgeState {
  const live = Object.entries(progress)
    .filter(([id]) => parsePackId(id)?.trailId === trailId)
    .map(([, p]) => p)

  if (live.some((p) => p.failed)) return { kind: 'failed' }
  const active = live.filter((p) => p.percentage < 100)
  if (active.length) {
    const pct = Math.round(active.reduce((s, p) => s + p.percentage, 0) / active.length)
    return { kind: 'downloading', pct }
  }

  const trailPacks = packs.filter((p) => parsePackId(p.id)?.trailId === trailId)
  if (trailPacks.some((p) => p.state === 'error')) return { kind: 'failed' }
  const downloading = trailPacks.filter((p) => p.state === 'downloading')
  if (downloading.length) {
    const pct = Math.round(downloading.reduce((s, p) => s + p.percentage, 0) / downloading.length)
    return { kind: 'downloading', pct }
  }
  const complete = trailPacks.filter((p) => p.state === 'complete')
  if (complete.length) {
    return { kind: 'available', styleIds: complete.map((p) => parsePackId(p.id)!.styleId) }
  }
  return { kind: 'none' }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/map/offline/__tests__/grouping.test.ts src/map/offline/__tests__/badge.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/map/offline/grouping.ts src/map/offline/badge.ts src/map/offline/__tests__/grouping.test.ts src/map/offline/__tests__/badge.test.ts
git commit -m "feat(offline): pack grouping + trail badge-state derivation"
```

---

### Task 5: Session store + trail-cascade operations

**Files:**
- Create: `src/map/offline/offlineStore.ts`
- Create: `src/map/offline/operations.ts`
- Test: `src/map/offline/__tests__/offlineStore.test.ts`, `src/map/offline/__tests__/operations.test.ts`

**Interfaces:**
- Consumes: `OfflineController`, `OfflinePackInfo` from `../provider/types`; `LiveProgress` from `./types`; `parsePackId` (Task 1).
- Produces:
  - `useOfflineStore` (Zustand) with state `{ packs: OfflinePackInfo[]; progress: Record<string, LiveProgress> }` and actions `refreshPacks(controller: OfflineController): Promise<void>`, `setProgress(id: string, percentage: number, failed: boolean): void`, `clearProgress(id: string): void`.
  - `packIdsForTrail(packs: OfflinePackInfo[], trailId: number): string[]`; `removeAllPacksForTrail(controller: OfflineController, trailId: number): Promise<void>`.

- [ ] **Step 1: Write the failing tests**

`src/map/offline/__tests__/offlineStore.test.ts`:
```ts
import { useOfflineStore } from '../offlineStore'
import { packId } from '../packId'
import type { OfflineController, OfflinePackInfo } from '../../provider/types'

const info = (id: string): OfflinePackInfo => ({ id, meta: null, state: 'complete', percentage: 100, sizeBytes: 1 })

const fakeController = (packs: OfflinePackInfo[]): OfflineController => ({
  downloadPack: async () => {},
  deletePack: async () => {},
  resumePack: async () => {},
  listPacks: async () => packs,
  subscribe: () => () => {},
})

beforeEach(() => useOfflineStore.setState({ packs: [], progress: {} }))

describe('offlineStore', () => {
  test('refreshPacks loads from the controller', async () => {
    await useOfflineStore.getState().refreshPacks(fakeController([info(packId(1, 'a'))]))
    expect(useOfflineStore.getState().packs).toHaveLength(1)
  })
  test('setProgress then clearProgress', () => {
    const id = packId(1, 'a')
    useOfflineStore.getState().setProgress(id, 30, false)
    expect(useOfflineStore.getState().progress[id]).toEqual({ percentage: 30, failed: false })
    useOfflineStore.getState().clearProgress(id)
    expect(useOfflineStore.getState().progress[id]).toBeUndefined()
  })
})
```

`src/map/offline/__tests__/operations.test.ts`:
```ts
import { packIdsForTrail, removeAllPacksForTrail } from '../operations'
import { packId } from '../packId'
import type { OfflineController, OfflinePackInfo } from '../../provider/types'

const info = (id: string): OfflinePackInfo => ({ id, meta: null, state: 'complete', percentage: 100, sizeBytes: 1 })

describe('packIdsForTrail', () => {
  test('returns only the target trail\'s pack ids', () => {
    const packs = [info(packId(1, 'a')), info(packId(1, 'b')), info(packId(2, 'a')), info('foreign')]
    expect(packIdsForTrail(packs, 1)).toEqual([packId(1, 'a'), packId(1, 'b')])
  })
})

describe('removeAllPacksForTrail', () => {
  test('deletes every pack belonging to the trail', async () => {
    const deleted: string[] = []
    const controller: OfflineController = {
      downloadPack: async () => {},
      deletePack: async (id) => { deleted.push(id) },
      resumePack: async () => {},
      listPacks: async () => [info(packId(5, 'a')), info(packId(5, 'b')), info(packId(6, 'a'))],
      subscribe: () => () => {},
    }
    await removeAllPacksForTrail(controller, 5)
    expect(deleted.sort()).toEqual([packId(5, 'a'), packId(5, 'b')])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/map/offline/__tests__/offlineStore.test.ts src/map/offline/__tests__/operations.test.ts`
Expected: FAIL — cannot find `../offlineStore` / `../operations`.

- [ ] **Step 3: Write the implementations**

`src/map/offline/offlineStore.ts`:
```ts
import { create } from 'zustand'
import type { OfflineController, OfflinePackInfo } from '../provider/types'
import { LiveProgress } from './types'

interface OfflineStore {
  packs: OfflinePackInfo[]
  progress: Record<string, LiveProgress>
  refreshPacks: (controller: OfflineController) => Promise<void>
  setProgress: (id: string, percentage: number, failed: boolean) => void
  clearProgress: (id: string) => void
}

export const useOfflineStore = create<OfflineStore>((set) => ({
  packs: [],
  progress: {},
  refreshPacks: async (controller) => {
    set({ packs: await controller.listPacks() })
  },
  setProgress: (id, percentage, failed) =>
    set((s) => ({ progress: { ...s.progress, [id]: { percentage, failed } } })),
  clearProgress: (id) =>
    set((s) => {
      const next = { ...s.progress }
      delete next[id]
      return { progress: next }
    }),
}))
```

`src/map/offline/operations.ts`:
```ts
import type { OfflineController, OfflinePackInfo } from '../provider/types'
import { parsePackId } from './packId'

export function packIdsForTrail(packs: OfflinePackInfo[], trailId: number): string[] {
  return packs.filter((p) => parsePackId(p.id)?.trailId === trailId).map((p) => p.id)
}

export async function removeAllPacksForTrail(
  controller: OfflineController,
  trailId: number,
): Promise<void> {
  const packs = await controller.listPacks()
  await Promise.all(packIdsForTrail(packs, trailId).map((id) => controller.deletePack(id)))
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/map/offline/__tests__/offlineStore.test.ts src/map/offline/__tests__/operations.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/map/offline/offlineStore.ts src/map/offline/operations.ts src/map/offline/__tests__/offlineStore.test.ts src/map/offline/__tests__/operations.test.ts
git commit -m "feat(offline): session store (packs cache + live progress) + trail cascade ops"
```

---

### Task 6: Offline layer chooser sheet

**Files:**
- Create: `src/map/offline/OfflineLayerChooser.tsx`

**Interfaces:**
- Consumes: `useMapCapabilities`, `useOfflineController` (`src/map/provider`); `useMapStore` (`mapStyleId`); `useOfflineStore` (Task 5); `boundsForTrail` (Task 1); `estimatePackSize`/`layerKindForStyle` (Task 2); `OFFLINE_MIN_ZOOM`/`OFFLINE_MAX_ZOOM`/`OFFLINE_MARGIN_KM`/`TILE_COUNT_WARN_THRESHOLD` (Task 2); `packId` (Task 1); `offlineStateForTrail` (Task 4); `Trail` from `../../data/trails/types` (LEAF). `BottomSheetModal` from `@gorhom/bottom-sheet`.
- Produces: `OfflineLayerChooser` — `forwardRef<BottomSheetModal, { trail: Trail }>`. Parent presents it via `ref.current?.present()`.

**Behaviour:** Lists every `capabilities.styles` entry as a row (swatch preview, label, per-layer estimated or actual size, checkbox). Initial ticks = the trail's already-downloaded style ids (from `offlineStateForTrail`), or `{ current mapStyleId }` when none are downloaded. A running total of the *to-download* (newly-ticked, not-yet-present) layers shows at the bottom. On confirm: download newly-ticked layers, delete un-ticked-but-present layers, then dismiss and refresh. Warn via `Alert` before confirming if any newly-ticked layer's estimate exceeds `TILE_COUNT_WARN_THRESHOLD` tiles.

- [ ] **Step 1: Implement the component**

`src/map/offline/OfflineLayerChooser.tsx`:
```tsx
import React, { forwardRef, useMemo, useState, useEffect } from 'react'
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { BottomSheetModal, BottomSheetView, BottomSheetBackdrop, type BottomSheetBackdropProps } from '@gorhom/bottom-sheet'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../theme/useTheme'
import { useMapCapabilities, useOfflineController } from '../provider'
import { useMapStore } from '../../store/mapStore'
import { useOfflineStore } from './offlineStore'
import { boundsForTrail } from './bounds'
import { estimatePackSize, layerKindForStyle } from './estimate'
import { offlineStateForTrail } from './badge'
import { packId } from './packId'
import { OFFLINE_MARGIN_KM, OFFLINE_MAX_ZOOM, OFFLINE_MIN_ZOOM, TILE_COUNT_WARN_THRESHOLD } from './constants'
import type { Trail } from '../../data/trails/types'

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`
  if (bytes >= 1_000_000) return `${Math.round(bytes / 1_000_000)} MB`
  return `${Math.max(1, Math.round(bytes / 1000))} KB`
}

export const OfflineLayerChooser = forwardRef<BottomSheetModal, { trail: Trail }>(
  function OfflineLayerChooser({ trail }, ref) {
    const c = useTheme()
    const caps = useMapCapabilities()
    const controller = useOfflineController()
    const currentStyleId = useMapStore((s) => s.mapStyleId)
    const packs = useOfflineStore((s) => s.packs)
    const progress = useOfflineStore((s) => s.progress)
    const setProgress = useOfflineStore((s) => s.setProgress)
    const clearProgress = useOfflineStore((s) => s.clearProgress)
    const refreshPacks = useOfflineStore((s) => s.refreshPacks)

    const snapPoints = useMemo(() => ['65%'], [])
    const bounds = useMemo(() => boundsForTrail(trail.geometry.points, OFFLINE_MARGIN_KM), [trail])

    const state = offlineStateForTrail(trail.id, packs, progress)
    const downloadedIds = state.kind === 'available' ? state.styleIds : []

    const [selected, setSelected] = useState<Set<string>>(new Set())
    // Seed ticks whenever the trail's downloaded set or the current style changes.
    useEffect(() => {
      setSelected(new Set(downloadedIds.length ? downloadedIds : [currentStyleId]))
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [trail.id, downloadedIds.join(','), currentStyleId])

    const toggle = (id: string) =>
      setSelected((prev) => {
        const next = new Set(prev)
        next.has(id) ? next.delete(id) : next.add(id)
        return next
      })

    const rows = caps.styles.map((s) => {
      const kind = layerKindForStyle(s.satellite)
      const estimate = bounds ? estimatePackSize(bounds, OFFLINE_MIN_ZOOM, OFFLINE_MAX_ZOOM, kind) : null
      const downloaded = downloadedIds.includes(s.id)
      return { style: s, kind, estimate, downloaded }
    })

    const toDownloadBytes = rows
      .filter((r) => selected.has(r.style.id) && !r.downloaded && r.estimate)
      .reduce((sum, r) => sum + (r.estimate?.bytes ?? 0), 0)

    const renderBackdrop = (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />
    )

    const startDownload = (styleId: string, styleUrl: string) => {
      const id = packId(trail.id, styleId)
      setProgress(id, 0, false)
      controller
        .downloadPack({
          id,
          styleUrl,
          bounds: [bounds!.ne, bounds!.sw],
          minZoom: OFFLINE_MIN_ZOOM,
          maxZoom: OFFLINE_MAX_ZOOM,
          meta: { trailId: trail.id, styleId },
        })
        .then(() => {
          const unsub = controller.subscribe(
            id,
            (info) => {
              setProgress(id, info.percentage, false)
              if (info.state === 'complete') {
                clearProgress(id)
                refreshPacks(controller)
                unsub()
              }
            },
            () => {
              setProgress(id, 0, true)
              unsub()
            },
          )
        })
        .catch(() => setProgress(id, 0, true))
    }

    const apply = async () => {
      if (!bounds) {
        Alert.alert('Cannot download', 'This trail has no route to cover.')
        return
      }
      const adds = rows.filter((r) => selected.has(r.style.id) && !r.downloaded)
      const removes = rows.filter((r) => !selected.has(r.style.id) && r.downloaded)
      const big = adds.find((r) => (r.estimate?.tileCount ?? 0) > TILE_COUNT_WARN_THRESHOLD)

      const run = () => {
        adds.forEach((r) => startDownload(r.style.id, r.style.url))
        Promise.all(removes.map((r) => controller.deletePack(packId(trail.id, r.style.id)))).then(() =>
          refreshPacks(controller),
        )
        ;(ref as React.RefObject<BottomSheetModal>)?.current?.dismiss()
      }

      if (big) {
        Alert.alert(
          'Large download',
          `${big.style.label} is about ${formatBytes(big.estimate!.bytes)}. Download on Wi‑Fi to avoid using mobile data. Continue?`,
          [{ text: 'Cancel', style: 'cancel' }, { text: 'Download', onPress: run }],
        )
      } else {
        run()
      }
    }

    const hasChanges =
      rows.some((r) => selected.has(r.style.id) && !r.downloaded) ||
      rows.some((r) => !selected.has(r.style.id) && r.downloaded)

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={snapPoints}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: c.panelBackground }}
        handleIndicatorStyle={{ backgroundColor: c.onSurfaceVariant }}
      >
        <BottomSheetView style={styles.content}>
          <Text style={[styles.title, { color: c.panelContent }]}>Offline layers</Text>
          <Text style={[styles.sub, { color: c.onSurfaceVariant }]} numberOfLines={1}>
            {trail.name} · tick to download, untick to remove
          </Text>

          {rows.map((r) => {
            const on = selected.has(r.style.id)
            return (
              <Pressable
                key={r.style.id}
                accessibilitylabel={`${r.style.label} layer`}
                onPress={() => toggle(r.style.id)}
                style={[styles.row, { borderColor: on ? c.controlAccent : c.panelDivider }]}
              >
                <Image source={r.style.preview} style={styles.swatch} resizeMode="cover" />
                <View style={styles.meta}>
                  <Text style={[styles.name, { color: c.panelContent }]}>{r.style.label}</Text>
                  <Text style={{ fontSize: 11, color: r.downloaded ? c.controlAccent : r.kind === 'raster' ? c.difficultyHard : c.onSurfaceVariant }}>
                    {r.downloaded
                      ? `✓ Downloaded · ${r.estimate ? formatBytes(r.estimate.bytes) : ''}`
                      : r.estimate
                        ? `~${formatBytes(r.estimate.bytes)}`
                        : 'unavailable'}
                  </Text>
                </View>
                <Ionicons
                  name={on ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={on ? c.controlAccent : c.onSurfaceVariant}
                />
              </Pressable>
            )
          })}

          <View style={styles.totalRow}>
            <Text style={{ color: c.onSurfaceVariant, fontSize: 12 }}>To download</Text>
            <Text style={{ color: c.panelContent, fontSize: 13, fontWeight: '700' }}>
              {toDownloadBytes ? `~${formatBytes(toDownloadBytes)}` : '—'}
            </Text>
          </View>

          <Pressable
            accessibilityLabel="Apply offline layers"
            disabled={!hasChanges}
            onPress={apply}
            style={[styles.apply, { backgroundColor: c.controlAccent, opacity: hasChanges ? 1 : 0.5 }]}
          >
            <Text style={{ color: c.controlsText, fontWeight: '700', fontSize: 14 }}>Apply</Text>
          </Pressable>
        </BottomSheetView>
      </BottomSheetModal>
    )
  },
)

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 28, gap: 10 },
  title: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  sub: { fontSize: 11, textAlign: 'center', marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderWidth: 1, borderRadius: 12 },
  swatch: { width: 42, height: 42, borderRadius: 8 },
  meta: { flex: 1 },
  name: { fontSize: 13, fontWeight: '600' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  apply: { padding: 13, borderRadius: 12, alignItems: 'center', marginTop: 4 },
})
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Device-verify (manual — user)**

On phone SWWC4HEIYHZPQWZX: open a trail → ⋮ → Download for offline opens this chooser; the current layer is pre-ticked; sizes show (satellite larger/amber); ticking updates the total; Apply starts the download and dismisses. (Wiring to the ⋮ menu lands in Task 7.)

- [ ] **Step 4: Commit**

```bash
git add src/map/offline/OfflineLayerChooser.tsx
git commit -m "feat(offline): layer chooser sheet (deliberate multi-select + size estimates)"
```

---

### Task 7: Trail sheet — offline badge, progress, ⋮ menu

**Files:**
- Create: `src/map/offline/OfflineActionsMenu.tsx`
- Modify: `src/trails/TrailInfoSheet.tsx`

**Interfaces:**
- Consumes: `offlineStateForTrail` (Task 4); `useOfflineStore` (Task 5); `useOfflineController` (`src/map/provider`); `OfflineLayerChooser` (Task 6); `packIdsForTrail` (Task 5); `packId`/`parsePackId` (Task 1); `useRouter` from `expo-router`; `BottomSheetModal` type.
- Produces: `OfflineActionsMenu` — `{ items: { label: string; danger?: boolean; onPress: () => void }[]; onClose: () => void }`. Updated `TrailInfoSheet` (same props: `{ trail: Trail; animatedPosition?: SharedValue<number> }`).

**Behaviour:** Next to the trail name, render the offline badge from `offlineStateForTrail`: `downloading` → `⬇ N%` (and the summary line becomes a thin progress bar + "Downloading… N%"); `available` → `✓ Offline`; `failed` → `⚠ Failed`; `none` → nothing. A ⋮ button toggles `OfflineActionsMenu` with state-dependent items:
- `none` → **Download for offline** (present the chooser).
- `available` → **Edit offline layers** (present the chooser), **Manage offline maps** (`router.push('/settings/offline')`), **Remove offline maps** (confirm → delete all trail packs → refresh) [danger].
- `failed` → **Retry** (`resumePack` each of the trail's packs), **Remove offline maps** [danger].
- `downloading` → **Cancel download** (delete the trail's packs + clear progress) [danger].

- [ ] **Step 1: Implement the overflow menu**

`src/map/offline/OfflineActionsMenu.tsx`:
```tsx
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../../theme/useTheme'

export function OfflineActionsMenu({
  items,
  onClose,
}: {
  items: { label: string; danger?: boolean; onPress: () => void }[]
  onClose: () => void
}) {
  const c = useTheme()
  return (
    <>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close menu" />
      <View style={[styles.menu, { backgroundColor: c.surface, borderColor: c.panelDivider }]}>
        {items.map((item) => (
          <Pressable
            key={item.label}
            accessibilityLabel={item.label}
            onPress={() => {
              onClose()
              item.onPress()
            }}
            style={styles.item}
          >
            <Text style={{ color: item.danger ? c.danger : c.panelContent, fontSize: 13 }}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  menu: {
    position: 'absolute', top: 34, right: 0, minWidth: 190, borderWidth: 1, borderRadius: 10,
    paddingVertical: 4, elevation: 8, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, zIndex: 10,
  },
  item: { paddingVertical: 10, paddingHorizontal: 14 },
})
```

- [ ] **Step 2: Rewrite TrailInfoSheet with the badge + menu**

`src/trails/TrailInfoSheet.tsx`:
```tsx
import { useRef, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { SharedValue } from 'react-native-reanimated'
import type { BottomSheetModal } from '@gorhom/bottom-sheet'
import { useRouter } from 'expo-router'
import { Trail } from '../data/trails/types'
import { formatDistance, formatElevation, formatMetricsSummary } from '../data/trails/gpx/metrics'
import { useTheme } from '../theme/useTheme'
import { DifficultyBadge } from './DifficultyBadge'
import { MapInfoSheet } from '../map/MapInfoSheet'
import { MetricsGrid } from '../map/MetricsGrid'
import { useOfflineController } from '../map/provider'
import { useOfflineStore } from '../map/offline/offlineStore'
import { offlineStateForTrail } from '../map/offline/badge'
import { packIdsForTrail } from '../map/offline/operations'
import { OfflineLayerChooser } from '../map/offline/OfflineLayerChooser'
import { OfflineActionsMenu } from '../map/offline/OfflineActionsMenu'

export function TrailInfoSheet({
  trail,
  animatedPosition,
}: {
  trail: Trail
  animatedPosition?: SharedValue<number>
}) {
  const c = useTheme()
  const router = useRouter()
  const controller = useOfflineController()
  const packs = useOfflineStore((s) => s.packs)
  const progress = useOfflineStore((s) => s.progress)
  const clearProgress = useOfflineStore((s) => s.clearProgress)
  const refreshPacks = useOfflineStore((s) => s.refreshPacks)
  const chooserRef = useRef<BottomSheetModal>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  const state = offlineStateForTrail(trail.id, packs, progress)

  const removeAll = () => {
    Alert.alert('Remove offline maps', `Remove downloaded maps for "${trail.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const ids = packIdsForTrail(packs, trail.id)
          await Promise.all(ids.map((id) => controller.deletePack(id)))
          ids.forEach(clearProgress)
          await refreshPacks(controller)
        },
      },
    ])
  }

  const retry = async () => {
    const ids = packIdsForTrail(packs, trail.id)
    await Promise.all(ids.map((id) => controller.resumePack(id)))
  }

  const cancel = async () => {
    const ids = packIdsForTrail(packs, trail.id)
    await Promise.all(ids.map((id) => controller.deletePack(id)))
    ids.forEach(clearProgress)
    await refreshPacks(controller)
  }

  const menuItems =
    state.kind === 'none'
      ? [{ label: 'Download for offline', onPress: () => chooserRef.current?.present() }]
      : state.kind === 'available'
        ? [
            { label: 'Edit offline layers', onPress: () => chooserRef.current?.present() },
            { label: 'Manage offline maps', onPress: () => router.push('/settings/offline') },
            { label: 'Remove offline maps', danger: true, onPress: removeAll },
          ]
        : state.kind === 'failed'
          ? [
              { label: 'Retry download', onPress: retry },
              { label: 'Remove offline maps', danger: true, onPress: removeAll },
            ]
          : [{ label: 'Cancel download', danger: true, onPress: cancel }]

  return (
    <MapInfoSheet animatedPosition={animatedPosition}>
      <View style={styles.titleRow}>
        <Text style={[styles.name, { color: c.panelContent }]} numberOfLines={1}>{trail.name}</Text>
        {state.kind === 'downloading' && (
          <Text style={[styles.badge, { color: c.controlAccent }]}>⬇ {state.pct}%</Text>
        )}
        {state.kind === 'available' && (
          <Text style={[styles.badge, { color: c.difficultyEasy }]}>✓ Offline</Text>
        )}
        {state.kind === 'failed' && (
          <Text style={[styles.badge, { color: c.danger }]}>⚠ Failed</Text>
        )}
        <Pressable accessibilityLabel="Offline actions" onPress={() => setMenuOpen((o) => !o)} hitSlop={8}>
          <Ionicons name="ellipsis-vertical" size={20} color={c.onSurfaceVariant} />
        </Pressable>
        {menuOpen && <OfflineActionsMenu items={menuItems} onClose={() => setMenuOpen(false)} />}
      </View>

      {state.kind === 'downloading' ? (
        <View style={styles.progressWrap}>
          <View style={[styles.progressTrack, { backgroundColor: c.panelDivider }]}>
            <View style={[styles.progressFill, { backgroundColor: c.controlAccent, width: `${state.pct}%` }]} />
          </View>
          <Text style={[styles.summary, { color: c.onSurfaceVariant }]}>Downloading… {state.pct}%</Text>
        </View>
      ) : (
        <View style={styles.summaryRow}>
          <DifficultyBadge difficulty={trail.difficulty} />
          <Text style={[styles.summary, { color: c.onSurfaceVariant }]}>
            {formatMetricsSummary(trail.metrics)}
          </Text>
        </View>
      )}

      <MetricsGrid
        items={[
          { label: 'Distance', value: formatDistance(trail.metrics.distanceMeters) },
          { label: 'Elev. Gain', value: formatElevation(trail.metrics.elevationGainMeters) },
          { label: 'Elev. Loss', value: formatElevation(trail.metrics.elevationLossMeters) },
        ]}
      />

      {trail.description != null && (
        <Text style={[styles.comments, { color: c.panelContent }]}>{trail.description}</Text>
      )}

      <OfflineLayerChooser ref={chooserRef} trail={trail} />
    </MapInfoSheet>
  )
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 18, fontWeight: '700', flex: 1 },
  badge: { fontSize: 12, fontWeight: '700' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summary: { fontSize: 13, flexShrink: 1 },
  progressWrap: { gap: 6 },
  progressTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  comments: { fontSize: 14, lineHeight: 20 },
})
```

- [ ] **Step 3: Typecheck + full test run**

Run: `npx tsc --noEmit && npx jest`
Expected: tsc clean; all tests green (no new specs — presentational).

- [ ] **Step 4: Device-verify (manual — user)**

Open a trail → ⋮ shows "Download for offline" → chooser → download; badge shows `⬇ N%` with a progress bar, settling to `✓ Offline`; ⋮ then offers Edit / Manage / Remove. Force a network drop mid-download → `⚠ Failed` + Retry works.

- [ ] **Step 5: Commit**

```bash
git add src/map/offline/OfflineActionsMenu.tsx src/trails/TrailInfoSheet.tsx
git commit -m "feat(offline): trail sheet offline badge, progress + overflow actions"
```

---

### Task 8: Hoist providers to root + Settings → Offline maps screen

**Files:**
- Modify: `app/_layout.tsx` (wrap tree in `MapProviderProvider` + `BottomSheetModalProvider`)
- Modify: `src/map/MapScreen.tsx` (remove the now-hoisted providers)
- Create: `src/map/offline/OfflineMapsList.tsx`
- Create: `app/settings/offline.tsx`
- Modify: `app/(tabs)/settings.tsx` (add the navigation row)

**Interfaces:**
- Consumes: `groupPacksByTrail`/`totalOfflineBytes` (Task 4); `useOfflineStore` (Task 5); `useOfflineController` (`src/map/provider`); `useTrailsStore` (`src/store/trailsStore`); `mapboxProvider` (`src/map/providers/mapbox`); `MapProviderProvider` (`src/map/provider`); `BottomSheetModalProvider` (`@gorhom/bottom-sheet`); `useRouter` (expo-router).
- Produces: `OfflineMapsList` component; the `/settings/offline` route; a Settings row linking to it.

**Why hoist:** the Settings screen and the trails-tab cascade (Task 9) live outside the map tab's subtree, so `MapProviderProvider` (which supplies `useOfflineController`) and `BottomSheetModalProvider` (for the chooser modal) must be app-wide. MapScreen keeps consuming the context; it just no longer owns the providers.

- [ ] **Step 1: Hoist providers in `app/_layout.tsx`**

Add imports and wrap the ready branch. New file:
```tsx
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Text, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet'
import { MapProviderProvider } from '../src/map/provider'
import { mapboxProvider } from '../src/map/providers/mapbox'
import { useDatabaseMigrations } from '../src/data/db/useDatabaseMigrations'
import '../src/recording/locationTask'
import { useResumeRecording } from '../src/recording/useResumeRecording'
import { useIncomingShare } from '../src/trails/useIncomingShare'

function ShareIntentHandler() {
  useIncomingShare()
  return null
}

function ResumeRecordingHandler() {
  useResumeRecording()
  return null
}

export default function RootLayout() {
  const { success, error } = useDatabaseMigrations()

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      {error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text>Database failed to initialize: {error.message}</Text>
        </View>
      ) : success ? (
        <MapProviderProvider provider={mapboxProvider}>
          <BottomSheetModalProvider>
            <Stack screenOptions={{ headerShown: false }} />
            <ShareIntentHandler />
            <ResumeRecordingHandler />
          </BottomSheetModalProvider>
        </MapProviderProvider>
      ) : null}
    </GestureHandlerRootView>
  )
}
```

- [ ] **Step 2: Remove the hoisted providers from `src/map/MapScreen.tsx`**

Delete the `MapProviderProvider` and `BottomSheetModalProvider` wrappers (now provided by the root), keeping the inner tree. Update the imports: remove `MapProviderProvider` and `mapboxProvider`; change the bottom-sheet import to keep only what MapScreen still uses (`BottomSheetModal` type for `sheetRef`). Concretely:
- Line 4: `import { BottomSheetModal, BottomSheetModalProvider } from '@gorhom/bottom-sheet'` → `import { BottomSheetModal } from '@gorhom/bottom-sheet'`
- Lines 5-6: delete `import { MapProviderProvider } from './provider'` and `import { mapboxProvider } from './providers/mapbox'`
- Replace the returned tree's outer wrappers: remove the opening `<MapProviderProvider provider={mapboxProvider}>` and `<BottomSheetModalProvider>` and their matching closing tags, so the returned root becomes the `<View style={{ flex: 1 }} …>` … plus the sibling `<LayersSheet ref={sheetRef} />` wrapped in a single fragment `<>…</>`.

Resulting return shape:
```tsx
  return (
    <>
      <View style={{ flex: 1 }} onLayout={(e) => { rootHeight.value = e.nativeEvent.layout.height }}>
        {/* …unchanged children… */}
      </View>
      <LayersSheet ref={sheetRef} />
    </>
  )
```

- [ ] **Step 3: Implement the Settings list component**

`src/map/offline/OfflineMapsList.tsx`:
```tsx
import { useCallback } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from 'expo-router'
import { useTheme } from '../../theme/useTheme'
import { useOfflineController } from '../provider'
import { useOfflineStore } from './offlineStore'
import { useTrailsStore } from '../../store/trailsStore'
import { groupPacksByTrail, totalOfflineBytes } from './grouping'
import { packId } from './packId'

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`
  if (bytes >= 1_000_000) return `${Math.round(bytes / 1_000_000)} MB`
  return `${Math.max(1, Math.round(bytes / 1000))} KB`
}

export function OfflineMapsList() {
  const c = useTheme()
  const controller = useOfflineController()
  const packs = useOfflineStore((s) => s.packs)
  const refreshPacks = useOfflineStore((s) => s.refreshPacks)
  const trails = useTrailsStore((s) => s.trails)
  const loadTrails = useTrailsStore((s) => s.loadTrails)

  useFocusEffect(
    useCallback(() => {
      loadTrails()
      refreshPacks(controller)
    }, [loadTrails, refreshPacks, controller]),
  )

  const groups = groupPacksByTrail(packs, trails)
  const total = totalOfflineBytes(packs)

  const removeLayer = (trailId: number, styleId: string, trailName: string | null) => {
    Alert.alert('Remove layer', `Remove this offline layer for "${trailName ?? 'Unknown trail'}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await controller.deletePack(packId(trailId, styleId))
          await refreshPacks(controller)
        },
      },
    ])
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={[styles.storage, { backgroundColor: c.surface }]}>
        <Text style={{ color: c.onSurfaceVariant, fontSize: 12 }}>Storage used by offline maps</Text>
        <Text style={{ color: c.onSurface, fontSize: 15, fontWeight: '700', marginTop: 4 }}>{formatBytes(total)}</Text>
      </View>

      <Text style={[styles.section, { color: c.onSurfaceVariant }]}>TRAILS</Text>
      {groups.length === 0 ? (
        <Text style={{ color: c.onSurfaceVariant, paddingHorizontal: 4 }}>No offline maps yet.</Text>
      ) : (
        groups.map((g) => (
          <View key={g.trailId} style={[styles.group, { backgroundColor: c.surface }]}>
            <View style={styles.groupHead}>
              <Ionicons name="trail-sign" size={16} color={c.trailLine} />
              <Text style={{ color: c.onSurface, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                {g.trailName ?? 'Unknown trail'}
              </Text>
              <Text style={{ color: c.onSurfaceVariant, fontSize: 11 }}>{formatBytes(g.totalBytes)}</Text>
            </View>
            {g.layers.map((l) => (
              <View key={l.styleId} style={[styles.layer, { borderTopColor: c.panelDivider }]}>
                <Text style={{ color: c.onSurface, fontSize: 13, flex: 1 }}>{l.styleId}</Text>
                <Text style={{ color: c.onSurfaceVariant, fontSize: 11, marginRight: 12 }}>{formatBytes(l.sizeBytes)}</Text>
                <Pressable
                  accessibilityLabel={`Remove ${l.styleId} for ${g.trailName ?? 'unknown trail'}`}
                  onPress={() => removeLayer(g.trailId, l.styleId, g.trailName)}
                  hitSlop={8}
                >
                  <Ionicons name="trash-outline" size={18} color={c.danger} />
                </Pressable>
              </View>
            ))}
          </View>
        ))
      )}

      <Text style={[styles.section, { color: c.onSurfaceVariant, marginTop: 20 }]}>AREAS · LATER</Text>
      <View style={[styles.areaPlaceholder, { borderColor: c.panelDivider }]}>
        <Text style={{ color: c.onSurfaceVariant, fontSize: 13 }}>＋ Download a custom area</Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  storage: { borderRadius: 12, padding: 14, marginBottom: 18 },
  section: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 10, marginLeft: 2 },
  group: { borderRadius: 12, paddingHorizontal: 14, marginBottom: 14 },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  layer: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderTopWidth: 1 },
  areaPlaceholder: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, padding: 16, alignItems: 'center', opacity: 0.6 },
})
```

- [ ] **Step 4: Add the route**

`app/settings/offline.tsx`:
```tsx
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useTheme } from '../../src/theme/useTheme'
import { OfflineMapsList } from '../../src/map/offline/OfflineMapsList'

export default function OfflineMapsScreen() {
  const c = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.screen, { backgroundColor: c.background, paddingTop: insets.top }]}>
      <View style={styles.nav}>
        <Pressable accessibilityLabel="Back" onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={c.onSurface} />
        </Pressable>
        <Text style={[styles.title, { color: c.onSurface }]}>Offline maps</Text>
      </View>
      <OfflineMapsList />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 12 },
  title: { fontSize: 18, fontWeight: '700' },
})
```

- [ ] **Step 5: Add the Settings navigation row**

`app/(tabs)/settings.tsx`:
```tsx
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useTheme } from '../../src/theme/useTheme'

export default function Screen() {
  const c = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.screen, { backgroundColor: c.background, paddingTop: insets.top }]}>
      <Text style={[styles.title, { color: c.onSurface }]}>Settings</Text>
      <Pressable
        accessibilityLabel="Offline maps"
        onPress={() => router.push('/settings/offline')}
        style={[styles.row, { borderColor: c.panelDivider }]}
      >
        <Ionicons name="cloud-download-outline" size={20} color={c.onSurface} />
        <Text style={[styles.rowLabel, { color: c.onSurface }]}>Offline maps</Text>
        <Ionicons name="chevron-forward" size={20} color={c.onSurfaceVariant} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 12, borderWidth: 1, borderRadius: 12 },
  rowLabel: { flex: 1, fontSize: 15 },
})
```

- [ ] **Step 6: Typecheck + full test run**

Run: `npx tsc --noEmit && npx jest`
Expected: tsc clean; all prior tests green.

- [ ] **Step 7: Device-verify (manual — user)**

Settings → "Offline maps" opens the list; a downloaded trail appears grouped by name with per-layer sizes + remove; total storage shows at top; "Areas · LATER" placeholder present. Confirm the map tab still works after the provider hoist (trail select, layers sheet, record button).

- [ ] **Step 8: Commit**

```bash
git add app/_layout.tsx src/map/MapScreen.tsx src/map/offline/OfflineMapsList.tsx app/settings/offline.tsx "app/(tabs)/settings.tsx"
git commit -m "feat(offline): hoist map provider to root + Settings offline maps screen"
```

---

### Task 9: Cascade-delete offline packs on trail deletion

**Files:**
- Modify: `app/(tabs)/trails.tsx`

**Interfaces:**
- Consumes: `removeAllPacksForTrail` (Task 5); `useOfflineController` (`src/map/provider`), now available app-wide after the Task 8 hoist.
- Produces: no new exports — `confirmDelete` also clears the trail's offline packs.

**Behaviour:** When a trail is deleted, its offline packs must not be orphaned. `confirmDelete`'s `onPress` calls `removeAllPacksForTrail(controller, trail.id)` before `removeTrail(trail.id)`.

- [ ] **Step 1: Wire the cascade**

In `app/(tabs)/trails.tsx`:
- Add imports:
```tsx
import { useOfflineController } from '../../src/map/provider'
import { removeAllPacksForTrail } from '../../src/map/offline/operations'
```
- Inside the component, add: `const offlineController = useOfflineController()`.
- Add `offlineController` to `confirmDelete`'s `useCallback` dependency array.
- In the Delete button's `onPress`, before `await removeTrail(trail.id)`:
```tsx
              setPending(true)
              try {
                await removeAllPacksForTrail(offlineController, trail.id)
                await removeTrail(trail.id)
              } finally {
                setPending(false)
              }
```

- [ ] **Step 2: Typecheck + full test run**

Run: `npx tsc --noEmit && npx jest`
Expected: tsc clean; all tests green.

- [ ] **Step 3: Device-verify (manual — user)**

Download offline maps for a trail, delete the trail from the Trails tab, then open Settings → Offline maps: the trail's packs are gone (no "Unknown trail" orphan), storage total dropped.

- [ ] **Step 4: Commit**

```bash
git add "app/(tabs)/trails.tsx"
git commit -m "feat(offline): cascade-delete offline packs when a trail is deleted"
```

---

## Self-Review

**1. Spec coverage:**
- Trail-atomic packs, 1:1 (trail×layer), canonical naming → Task 1 (`packId`), Task 3 (metadata), used everywhere. ✓
- No geographic partial coverage (whole-trail bbox) → Task 1 (`boundsForTrail`). ✓
- Per-layer safe removal → Task 6 (chooser untick), Task 7 (remove), Task 8 (per-layer remove). ✓
- Automatic tile dedup → Task 3 (mapbox `deletePack` frees unshared tiles; no app logic needed). ✓
- Trail-sheet badge (downloading/available/failed determinate) → Task 4 (`offlineStateForTrail`), Task 7 (render). ✓
- ⋮ overflow with state-dependent actions → Task 7. ✓
- One chooser for download + edit, equal-peer layers, current layer pre-ticked, per-layer size + running total, fixed zoom → Task 6 + Task 2 constants. ✓
- Settings grouped by trail, total storage, per-layer remove, "Areas — LATER" → Task 8. ✓
- Provider seam / `OfflineController` / capability flag → Task 3. ✓
- No new DB table; derive from registry; session-only progress → Task 5. ✓
- Size estimates heuristic + labelled; tile-limit warn → Task 2 + Task 6. ✓ (Per-download
  cellular/metered warning DEFERRED to a follow-up — needs a native connectivity dep; see spec §8.)
- Error/failed + retry (`resume`) → Task 3 + Task 7. ✓
- Cascade delete → Task 9. ✓
- Deferred (area download placeholder only, no coverage-badges, etc.) → Task 8 placeholder; nothing else built. ✓

**2. Placeholder scan:** No "TBD"/"handle edge cases"/"similar to". Task 3 flags one *verification* (rnmapbox state enum) with the concrete documented values already coded — not a placeholder. ✓

**3. Type consistency:** `packId`/`parsePackId`, `OfflinePackInfo`/`OfflinePackDescriptor`/`OfflineController`, `LngLatBounds` (`{ne,sw}` as `[lng,lat]`), `OfflineBadgeState` union, `LiveProgress`, `useOfflineStore` action names (`refreshPacks`/`setProgress`/`clearProgress`), `useOfflineController` — all defined once (Tasks 1/3/5) and consumed with matching signatures downstream. Chooser converts `LngLatBounds` → descriptor `bounds: [ne, sw]` consistently. ✓
