# Trail: show on map & fit into view — Design

**Date:** 2026-08-20
**Status:** Approved (design)

## Goal

Tapping a saved trail in the Trails list switches to the Map tab, draws the
trail on the map (line + directional arrows + start/end dots), fits the camera
to the whole trail, and shows a slim info card with a close button that clears
the selection.

This is the next slice of the trails integration, following the add-GPX slice.
Photos and edit mode remain out of scope.

## Scope

**In:**
- Whole-card tap on a trail list item → select + navigate to Map tab.
- Trail overlay behind the provider seam: line, directional arrows, start/end
  dots (full visual parity with the Kotlin `TrailOverlayLayer`).
- One-shot camera fit to the trail's extent, with padding that leaves room for
  the card at the bottom.
- Slim on-map info card (name, difficulty, distance • gain) with a close button
  that clears the selection.

**Out (deferred, unchanged from prior decisions):**
- Trail photos / thumbnail on the card / photo gallery.
- Edit mode.
- Waypoint rendering.
- Re-fit affordance (fit happens once per selection; the user is then free to
  pan/zoom).

## Architecture — the inviolable seams hold

Rendering a polyline and fitting the camera are rnmapbox-specific. Both live
**behind the map-provider seam** (`src/map/providers/mapbox/`) and are exposed
as SDK-neutral additions to the port (`src/map/provider/`). No new `@rnmapbox`
import appears in shared store/UI code.

The persistence seam also holds: the new selection-loader hook imports
`trailsRepository` from the `src/data/trails` barrel (the composition point,
like the store) and `Trail` from the `types` leaf — no `expo-sqlite`/`drizzle`
in the map layer.

### Port additions (`src/map/provider/types.ts`)

A new neutral overlay component on `MapComponents`:

```ts
export interface TrailOverlayProps {
  line: [number, number][]        // [lng, lat] pairs, in trail order
  endpoints: [number, number][]   // [start, end], each [lng, lat]
  color: string
  lineWidth: number
  arrowImage: number              // require()'d PNG asset handle (RN-neutral)
  arrowSpacing: number
  arrowSize: number
  endpointRadius: number
  endpointStrokeColor: string
  endpointStrokeWidth: number
}
```

`MapComponents` gains: `TrailOverlay: React.ComponentType<TrailOverlayProps>`.

A second imperative camera affordance on `CameraController`, mirroring the
existing one-shot `resetNorth`:

```ts
fitBounds(
  ne: [number, number],
  sw: [number, number],
  padding: [number, number, number, number], // [top, right, bottom, left]
  duration: number,
): void
```

### Adapter (`src/map/providers/mapbox/adapter.tsx`)

- Implements `TrailOverlay` with:
  - `Mapbox.ShapeSource` carrying a GeoJSON `LineString` of `line`.
  - `Mapbox.LineLayer` — `lineColor=color`, `lineWidth`, round cap & join.
  - `Mapbox.SymbolLayer` — `symbolPlacement: 'line'`, `symbolSpacing=arrowSpacing`,
    `iconImage: 'trail-arrow'`, `iconSize=arrowSize`, `iconAllowOverlap: true`,
    `iconRotationAlignment: 'map'`.
  - `Mapbox.CircleLayer` on a second source (start/end features) —
    `circleColor=color`, `circleRadius=endpointRadius`,
    `circleStrokeColor=endpointStrokeColor`, `circleStrokeWidth=endpointStrokeWidth`.
  - `Mapbox.Images images={{ 'trail-arrow': arrowImage }}` to register the icon.
- Extends the `Camera` `useImperativeHandle` with `fitBounds`, delegating to the
  rnmapbox `Camera` ref's `fitBounds(ne, sw, padding, duration)`.

GeoJSON assembly stays thin inside the adapter (rendering concern); the neutral
[lng,lat] shaping is done by tested pure helpers (below).

## Selection state (`src/store/mapStore.ts`)

Repurpose the already-present but unused `selectedTrailId` / `setSelectedTrailId`
into two intention-revealing, pure, testable actions:

- `selectTrail(id: number)` → sets `{ selectedTrailId: id, followMode: 'off' }`.
  Follow is turned off so the fit is not fighting the follow-puck camera
  (mirrors Kotlin `MapViewModel.selectTrail`, which sets `FollowMode.Off`).
- `clearSelectedTrail()` → sets `{ selectedTrailId: null }`. Follow is left as-is
  (mirrors Kotlin `clearSelectedTrail`).

`selectedTrailId` stays session-only (already excluded from `partialize`). The
`setSelectedTrailId` action is removed (nothing consumes it).

## Data flow

1. **`useSelectedTrail()`** — new hook in `src/map/`. Reads `selectedTrailId`;
   when non-null, loads the full `Trail` via `trailsRepository.getTrail(id)`.
   An `active` flag captured per-effect guards against out-of-order async
   results (the Kotlin "is this still the current selection?" check): a load
   whose selection has since changed is discarded. Returns `Trail | null`.
   Impure edge — device-verified, not unit-tested.
2. **`MapScreen`** calls `useSelectedTrail()` once and passes the loaded `Trail`
   to both consumers, so it is loaded a single time:
   - `MapCanvas` (needs geometry for overlay + fit),
   - `TrailInfoCard` (needs name / difficulty / metrics).
3. **`MapCanvas`** accepts the `trail` prop. When `trail` has ≥ 2 points it
   renders `<TrailOverlay …>` (props built from the pure helpers + `MapTokens` +
   theme `trailLine` color + the arrow asset) and fires
   `cameraRef.fitBounds(ne, sw, padding, MapTokens.trailFitDurationMs)` inside a
   `useEffect` keyed on the trail identity — the RN mirror of Kotlin's
   `LaunchedEffect(selectedTrail)` one-shot fit.

## Pure logic (TDD first, `src/map/`)

New tested module(s) with Jest specs written before implementation:

- `boundsForPoints(points: GpxPoint[]): { ne: [number, number]; sw: [number, number] } | null`
  — min/max lng & lat across points; `null` for an empty list. `ne = [maxLng, maxLat]`,
  `sw = [minLng, minLat]`.
- `toLineCoordinates(points: GpxPoint[]): [number, number][]` — map to `[lng, lat]`
  pairs in order.
- `endpointCoordinates(points: GpxPoint[]): [number, number][]` — `[first, last]`
  as `[lng, lat]`; empty for `< 1` point.

Store transitions `selectTrail` / `clearSelectedTrail` are covered in the
existing `src/store/__tests__/mapStore.test.ts`.

## UI

- **`src/trails/TrailListItem.tsx`** — the card body becomes a `Pressable` firing
  `onSelect(trail.id)`; the existing delete button remains a separate,
  independent hit target (its press must not also trigger select).
- **`app/(tabs)/trails.tsx`** — `onSelect(id)` calls `selectTrail(id)` then
  navigates to the Map tab (`router.navigate` to the map route). No change to the
  add-GPX flow.
- **`src/trails/TrailInfoCard.tsx`** (new, presentational) — slim card:
  hiking-icon placeholder (no photo), trail name (1 line, ellipsized),
  `DifficultyBadge`, `"<distance> • <gain> gain"` via `formatDistance` /
  `formatElevation`, and a close button. Uses the reserved `panelBackground` /
  `panelContent` theme tokens. Takes `{ trail, onClose }`.
- **`src/map/MapScreen.tsx`** — renders `<TrailInfoCard>` absolutely positioned,
  anchored to the bottom above the tab bar (respecting safe-area insets), only
  when a trail is loaded; `onClose` calls `clearSelectedTrail()`.

## Tokens & assets

`MapTokens` (`src/theme/tokens.ts`) gains (values from Kotlin `MapLayer`):

- `trailLineWidth: 4`
- `arrowSpacing: 100`
- `arrowSize: 0.8`
- `endpointRadius: 8`
- `endpointStrokeWidth: 2.5`
- `cameraPadding: { top: 100, sides: 100, bottom: 300 }`
- `trailFitDurationMs: 1000`

Trail line color comes from the existing theme token `trailLine` (`#9C27B0`);
endpoint stroke is white (as in Kotlin).

New asset `assets/trail-arrow.png` — a small white directional arrow (~48 px),
bundled and registered via rnmapbox `<Images>`. This is the "full parity" native
work opted into. It is provider-agnostic (a plain image handle passed through the
neutral port prop).

## Error / edge handling

- `getTrail` returns `null` (trail deleted between list render and load): no
  overlay, no card, no fit — all gated on a non-null loaded trail.
- Trail with `< 2` points: nothing drawn and no fit (mirrors Kotlin's
  `trailPoints.size >= 2` guard).
- Out-of-order async loads discarded via the `active` guard.
- Selecting a different trail while one is shown: the hook reloads; the fit
  effect (keyed on trail identity) re-fires for the new trail.

## Divergences from Kotlin (deliberate)

- **Imperative `fitBounds` (one-shot on selection)** instead of a declarative
  `bounds` prop. Rationale: matches the existing `resetNorth` one-shot imperative
  pattern, and avoids a persistent `bounds` prop fighting follow-mode after the
  fit completes. The fit is inherently a one-time action per selection.
- **No thumbnail on the info card** — photos are deferred, so the card shows a
  hiking-icon placeholder.

## Testing

- **Jest (written first):** `boundsForPoints`, `toLineCoordinates`,
  `endpointCoordinates`; `selectTrail` / `clearSelectedTrail` store transitions.
- **Device-verified:** line + arrows + endpoint dots render; camera fits the
  trail with the bottom padding leaving room for the card; whole-card tap selects
  and switches to the Map tab; close clears overlay + card; selecting a second
  trail re-fits. Because a new asset import goes through Metro, confirm a real
  release bundle (`npx expo export --platform android`) in addition to
  `tsc`/`jest` — a passing `tsc`/`jest` does not exercise bundling.
