# One owner for profile + slope banding (backlog item 7)

Closes **DUP-2** and **PERF-2**.

## Problem

The same elevation profile, and the same slope banding derived from it, are computed three times
for one selected route:

| # | Site | Derives |
|---|---|---|
| 1 | `src/map/MapScreen.tsx:61-65` | `buildElevationProfile` from `profileSegmentsFor(...)` → `activeProfile` |
| 2 | `src/elevation/useRouteColouring.ts:18-27`, reached from `src/map/MapCanvas.tsx:69` | `buildElevationProfile` **and** `displaySlopeBands`, from the same segments |
| 3 | `src/elevation/ElevationGraph.tsx:48` | `displaySlopeBands`, on the profile it was handed |

Each derivation walks every point of the route doing a haversine per point, and the banding pass
smooths and re-runs the whole sample series. For a 13-15 km trail that is thousands of points,
three times, synchronously on the JS thread, on every selection and on every smoothing change —
and during a recording, on every fix batch.

Measured on-device 2026-10-07 (release build, Pixel-class phone), selecting a 13.3 km trail:
657 ms of frame activity, longest single frame 135 ms, one 90 ms gap with nothing drawn at all.
That window is the rendering tail only; the JS work preceding the first new frame is not counted.

`POST-WORK.md` §3 requires derived state to have one owner. The previous report deduplicated the
banding *function* (`displaySlopeBands`); this change gives its *result* a single owner.

## Existing shape

The closest existing feature of the same shape is **`useLoadedEntity` + `resolveLoad`** (backlog
item 6, `f325ff6`): a pure, fully-tested core function paired with a thin hook that does only the
React wiring. That split exists because the project tests pure logic and device-verifies hooks and
native rendering — there is no `renderHook` anywhere in the repo, by design.

This change reuses that shape exactly: `routeDisplay()` is the pure core, `useRouteDisplay()` the
thin hook. Nothing new is invented.

What is extracted to be shared: the `RouteDisplay` bundle itself — today each consumer rebuilds its
own copy of what is conceptually one value, "the elevation view of the route currently on screen".

## Design

### The value

```ts
export interface RouteDisplay {
  profile: ElevationProfile   // raw: what is plotted and what carries lat/lng
  smoothed: ElevationProfile  // smoothed: where band boundaries come from, and the scrub grade
  bands: SlopeBand[]
}
```

`profile` and `smoothed` are both kept deliberately. Consumers plot and position from the raw
profile but take boundaries and grade from the smoothed one; collapsing them would change what is
drawn. See "Behaviour that must not change".

### The pure core — `src/elevation/routeDisplay.ts`

```ts
export function routeDisplay(
  segments: ElePoint[][] | null,
  smoothingMeters: number,
): RouteDisplay | null
```

Returns `null` when `segments` is null or `buildElevationProfile` returns null (fewer than two
elevation samples, or zero total distance). Otherwise composes `buildElevationProfile` +
`displaySlopeBands` into the bundle. TDD'd.

### The thin hook — `src/map/useRouteDisplay.ts`

```ts
export function useRouteDisplay(
  mode: MapMode,
  trail: Trail | null,
  activity: Activity | null,
  livePoints: LiveTrackPoint[],
): RouteDisplay | null
```

Calls `profileSegmentsFor`, reads `elevationSmoothingMeters` from `preferencesStore`, and wraps
`routeDisplay` in one `useMemo`. It lives in `src/map/` because `profileSegmentsFor` already does:
it depends on `MapMode` and on the activities mapping, which are map/data concerns, not elevation
ones. Device-verified, not unit-tested, per the precedent above.

This hook becomes **the only place the smoothing preference is read for display**, which is what
makes the smoothing contract structural rather than conventional. `src/elevation/ElevationGraph.tsx`
and `src/elevation/useRouteColouring.ts` both stop reading it.

### Consumer changes

- **`MapScreen`** — `activeProfile` becomes `useRouteDisplay(mode, trail, activity, livePoints)`.
  `showFloatingGraph` / `sheetProfile` become `sheetDisplay` equivalents on the same conditions.
  Passes the bundle to `MapCanvas` as a new `display` prop.
- **`TrailInfoSheet`, `ActivityInfoSheet`, `RecordingInfoSheet`** — the forwarded prop changes type
  and name: `profile: ElevationProfile | null` → `display: RouteDisplay | null`. All three only
  forward it to `ElevationGraph`; none reads it.
- **`ElevationGraph`** — takes `display` instead of `profile`; deletes its `displaySlopeBands`
  `useMemo` and its `usePreferencesStore` read. `buildBandTops`, `sampleAt` and the scrub path use
  `display.profile` / `display.smoothed` / `display.bands` exactly as they use the local values today.
- **`MapCanvas`** — gains `display: RouteDisplay | null`; calls `useRouteColouring(route ? display : null)`.
  The `route ? ... : null` gate is explicit and load-bearing: it preserves today's rule that only a
  trail or activity route is slope-coloured.
- **`useRouteColouring`** — signature becomes `(display: RouteDisplay | null) => ColouredLine[] | undefined`.
  Drops `buildElevationProfile` and `displaySlopeBands`; keeps `buildSlopeRuns` + `slopeBandColour`,
  and keeps owning the metric choice, which is its documented role.

## Behaviour that must not change

This is a pure refactor. Every pixel stays identical. Three specifics are easy to break:

1. **Raw profile, smoothed bands.** `buildSlopeRuns(profile, bands)` and `buildBandTops(profile,
   bands, ...)` are both called with the **raw** profile and bands derived from the **smoothed** one.
   That asymmetry is deliberate: smoothing is a legibility control over where bands begin and end,
   never over what is drawn. Passing `smoothed` to either would visibly change the rendering.
2. **The live track stays a plain line.** Only a trail or activity route is coloured. During a
   recording with no trail selected the graph is slope-coloured while the live track is not. That
   inconsistency is real and is logged separately as DUP-9; it is explicitly **out of scope** here.
3. **Recording-mode source selection.** `profileSegmentsFor` uses the trail when one is selected and
   live points otherwise; `trailToShow` agrees with it mode for mode. Both stay untouched.

## Testing

- `src/elevation/__tests__/routeDisplay.test.ts`, written first: null segments → null; a sub-threshold
  route (one sample, or zero distance) → null; a real multi-segment route → bundle whose `profile`
  matches `buildElevationProfile` and whose `bands` match `displaySlopeBands`; smoothing of 0 vs a
  real window produces different band boundaries from the same input.
- Device verification, since map rendering and the graph are not unit-tested: select a trail
  (coloured route + graph), select an activity, start a recording with and without a trail, change
  the smoothing preference and confirm the bands move in the graph and on the route together, and
  switch the graph between floating and in-sheet placement.

## Expected effect

Three derivations become one. The direct arithmetic saving on a trail selection is roughly two
thirds of the profile and banding work. It will not make the switch instant — the full-geometry
read and `JSON.parse`, and the map layer rebuild, are untouched and are the other half of the
measured cost. Honest expectation: a noticeable improvement on long trails, not a cure.

## Out of scope

- **DUP-9** (new): the live track cannot be slope-coloured because the port's `RouteLine` has no
  coloured-line path, unlike `TrailOverlay`. Logged in the review doc; not fixed here.
- The full-geometry read and `JSON.parse` on selection — the other half of the measured cost.
  **PERF-1** already covered this and is **done** (`085d4da`): it removed the *spurious* re-reads on
  every list-tab focus. One read per genuine selection is inherent to loading a trail, not a defect,
  and nothing here changes it.
- PERF-3 (progress ticks re-render the trail sheet).
