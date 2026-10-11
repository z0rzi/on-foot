# Elevation Graph + Slope-Coloured Route — Final Design

**Date:** 2026-09-03
**Status:** Target architecture for the refactor (consolidates the iterative specs of 2026-09-02/03)

This is the clean end-state the feature should occupy — what it would look like designed from
scratch knowing the final design. It supersedes the incremental specs as the reference. A fresh
three-reviewer pass produced the gaps this design closes (one real bug + extensibility + dedup).

## The feature (unchanged in behaviour)

An elevation graph (dual placement: floating over the map, or inside the info sheet) and a
slope-coloured trail line on the map. Slope model shared between the two surfaces. Colour on the
map + thickness/contrast on the graph = a redundant, colour-blind-safe encoding.

## Layering (target)

```
pure core (src/elevation/, no React, no SDK)
  profile.ts     raw profile: buildElevationProfile, gradeBand, sampleAt, types
  slope.ts       smoothed model: smoothProfile, slopeBands (per-segment)
  bandGeometry.ts  NEW — bandSamples(profile, band): the band's samples within its OWN segment,
                   with interpolated boundary samples. THE single segment-scoped boundary helper.
  svg.ts         projection + graph geometry (buildBandAreas / buildBandLines) — consumes bandSamples
  mapSlope.ts    buildSlopeRuns: [lng,lat] runs per band — consumes bandSamples
  slopeColour.ts NEW — slopeBandColour(band, colors): the ONE GradeBand→theme-colour map
component (src/elevation/)
  ElevationGraph.tsx   dual-mode renderer; pure band-style maps at module scope
  useRouteColouring.ts NEW — hook: OverlayRoute → ColouredLine[] | undefined (owns the metric choice)
map seam (unchanged, already provider-agnostic)
  provider/types.ts    ColouredLine {coordinates,color}; overlay accepts colouredLines?: ColouredLine[]
  providers/mapbox/adapter.tsx   draws them with data-driven ['get','color']
  MapOverlays.tsx      METRIC-AGNOSTIC: receives colouredLines as input, only does z-order + geo
  MapCanvas.tsx        calls useRouteColouring(route), passes colouredLines down
```

## Key design decisions

### 1. One segment-scoped boundary helper (fixes the bug + the fork)

**Bug being fixed:** `svg.ts`'s `bandTopPoints` resolved band-boundary elevation with the *global*
`sampleAt(profile, distance)`, which crosses segments (a break carries zero distance, so segment
B's start distance matches segment A's endpoint). Result: every non-first segment's band plunges to
the previous segment's ending elevation at its left edge. `mapSlope.ts` already did it correctly
(segment-scoped). Confirmed with a numeric test (33px error on a 50px plot).

**Fix:** one shared `bandSamples(profile, band): ElevationSample[]` in `bandGeometry.ts`:
identify the band's segment (per-segment distance ranges touch only at endpoints, so the band
midpoint is unambiguous — the technique `buildSlopeRuns` already uses), take that segment's samples,
interpolate a full `ElevationSample` (distance/ele/lat/lng) at the exact band start and end *within
that segment*, return `[start, ...inner, end]`. Both `svg.ts` (projects to x/y) and `mapSlope.ts`
(maps to lng/lat) consume it. No fork, no cross-segment lookup.

### 2. Colouring is an input to the map, chosen by a hook (extensibility)

Today the slope→colour pipeline runs *inside* `MapOverlays`, so colouring is not "an argument of the
route" and adding speed-colouring for activities would force a shotgun edit there. Target:

- **`ColouredLine`** is a named type on the port. The port/adapter are already metric-agnostic
  (pre-coloured polylines, `['get','color']`) — keep that; just name the type.
- **`useRouteColouring(route): ColouredLine[] | undefined`** owns the metric decision. Today it
  slope-colours every route (`buildElevationProfile → smoothProfile → slopeBands → buildSlopeRuns`,
  then `slopeBandColour`, flat → `c.slopeFlat`). It reads the smoothing preference internally.
- **`MapCanvas`** calls the hook and passes `colouredLines` into `MapOverlays` as a prop.
  `MapOverlays` loses all elevation imports and just renders what it's given (z-order + geo).

**Future (documented, NOT built now — YAGNI):** when speed-colouring lands, the branch lives *inside
`useRouteColouring`* (`route.kind === 'activity'` → speed, else slope) — a single dispatching hook,
so React hook rules are respected and the map seam still never learns a new concept. No metric
registry, no `colourBy` enum threading. One hook is the seam.

### 3. One band→colour map

`slopeBandColour(band, colors)` in `slopeColour.ts` is the single `GradeBand → theme colour` source,
used by `useRouteColouring` and by `ElevationGraph`'s `fillColour`. The graph's in-sheet **flat →
sheet colour** override stays at the graph call site (it's a graph-only presentation choice); the map
flat → `c.slopeFlat`.

### 4. Graph internals

- `ElevationGraph` stays one dual-mode component (reviewers agreed splitting duplicates more than it
  saves). But the **pure band-style maps** (`lineWidth`, `lineContrast`) move to module scope — they
  depend only on `GradeBand`. `fillColour` stays in-component (closes over theme + placement).
- Collapse the dead `plotWidth = width` alias; keep `scale` derivation honest with its memo deps.

## Testing

- **`bandGeometry.ts`** TDD'd, including the **multi-segment** case that exposes the bug: a band in
  segment N≥1 uses its own segment's start/end elevation (the regression test).
- `svg.ts` / `mapSlope.ts` keep their tests (now thinner — they delegate to `bandSamples`); add the
  multi-segment assertion the old suite lacked.
- Tighten the two weak assertions flagged (profile null-skip → assert ~2 hops; mapSlope smoke).
- `useRouteColouring` / rendering / wiring are device-verified (hooks + native), not unit-tested.

## Out of scope

- Speed-colouring itself (only the seam that will receive it).
- Any behaviour change — this is a structure/correctness refactor; the on-screen result is identical
  except the multi-segment band bug is fixed.
