# Map Trail Slope Colouring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Colour the selected trail's / activity's route line on the map by slope, reusing the elevation graph's smoothed slope model. Colour only (no thickness).

**Architecture:** A pure `buildSlopeRuns` turns an `ElevationProfile` + `SlopeBand[]` into `[lng,lat]` coordinate runs tagged by band (per segment, never crossing a break). Shared map code maps band → theme colour and hands the provider a generic list of coloured polylines through a new port field; the Mapbox adapter draws them with a single data-driven `LineLayer`. The seam stays intact — the port never learns about slope.

**Tech Stack:** TypeScript (strict), @rnmapbox/maps behind the seam, Jest. No new dependencies.

## Global Constraints

- **Map-provider seam is inviolable** — only `src/map/providers/mapbox/` imports the SDK. The new port field is provider-agnostic (`{coordinates, color}[]`); `GradeBand` never reaches the port.
- **Pure logic TDD'd; native rendering device-verified.**
- **Reuse, don't fork:** the map colouring uses the SAME `buildElevationProfile` + `smoothProfile` + `slopeBands` + `elevationSmoothingMeters` preference as the elevation graph. Accurate coordinates from the raw profile; bands from the smoothed profile.
- **Breaks stay breaks:** a coloured run never spans a segment gap.
- **Decision (confirm before Task 4):** v1 is **always-on** slope colouring for the selected trail/activity; **flat** sections use the route's identity colour (trail/activity), slopes use the theme ramp. No toggle in v1.
- Minimal comments; self-documenting code.

---

### Task 1: `buildSlopeRuns` (pure core)

**Files:**
- Create: `src/elevation/mapSlope.ts`
- Test: `src/elevation/__tests__/mapSlope.test.ts`

**Interfaces:**
- Consumes: `ElevationProfile`, `ElevationSample`, `GradeBand`, `sampleAt` (`./profile`); `SlopeBand` (`./slope`).
- Produces:
  ```ts
  export interface SlopeRun { band: GradeBand; coordinates: [number, number][] } // [lng, lat]
  export function buildSlopeRuns(profile: ElevationProfile, bands: SlopeBand[]): SlopeRun[]
  ```
  One run per band. A run's coordinates are the `[lng, lat]` of the raw profile samples whose distance lies within the band, with interpolated `[lng,lat]` at the band start/end so adjacent runs share a boundary point (no visual gap). Runs are built **per profile segment** — a run never spans a break, and boundary coordinates are interpolated between same-segment neighbouring samples (never via a global distance lookup, which is ambiguous where two segments share a cumulative distance).

- [ ] **Step 1: Write the failing tests**

```ts
// src/elevation/__tests__/mapSlope.test.ts
import { buildSlopeRuns } from '../mapSlope'
import { buildElevationProfile, ElePoint } from '../profile'
import type { SlopeBand } from '../slope'

describe('buildSlopeRuns', () => {
  const oneSeg = buildElevationProfile([[
    { lat: 0, lng: 0, ele: 0 },
    { lat: 0, lng: 0.001, ele: 40 },
    { lat: 0, lng: 0.002, ele: 45 },
  ]])!

  it('emits one coordinate run per band, tagged with the band', () => {
    const bands: SlopeBand[] = [
      { start: 0, end: oneSeg.totalDistance / 2, band: 'steep' },
      { start: oneSeg.totalDistance / 2, end: oneSeg.totalDistance, band: 'flat' },
    ]
    const runs = buildSlopeRuns(oneSeg, bands)
    expect(runs.map((r) => r.band)).toEqual(['steep', 'flat'])
    for (const r of runs) {
      expect(r.coordinates.length).toBeGreaterThanOrEqual(2)
      for (const [lng, lat] of r.coordinates) {
        expect(typeof lng).toBe('number')
        expect(typeof lat).toBe('number')
      }
    }
  })

  it('adjacent runs share their boundary coordinate (no gap on the map)', () => {
    const mid = oneSeg.totalDistance / 2
    const runs = buildSlopeRuns(oneSeg, [
      { start: 0, end: mid, band: 'steep' },
      { start: mid, end: oneSeg.totalDistance, band: 'uphill' },
    ])
    const endOfFirst = runs[0].coordinates[runs[0].coordinates.length - 1]
    const startOfSecond = runs[1].coordinates[0]
    expect(startOfSecond[0]).toBeCloseTo(endOfFirst[0], 9)
    expect(startOfSecond[1]).toBeCloseTo(endOfFirst[1], 9)
  })

  it('never lets a run cross a segment break', () => {
    // Segment A near lng 0, segment B near lng 1. A run must stay within one segment's coords.
    const twoSeg = buildElevationProfile([
      [{ lat: 0, lng: 0, ele: 0 }, { lat: 0, lng: 0.001, ele: 44 }],
      [{ lat: 0, lng: 1, ele: 100 }, { lat: 0, lng: 1.001, ele: 60 }],
    ])!
    // Bands are per-segment (as slopeBands produces): one steep run in A, one downhill run in B.
    const dA = twoSeg.samples[1].distance
    const runs = buildSlopeRuns(twoSeg, [
      { start: 0, end: dA, band: 'steep' },
      { start: dA, end: twoSeg.totalDistance, band: 'downhill' },
    ])
    // Run A's coords all near lng 0; run B's all near lng 1 — no coordinate bridges the gap.
    expect(Math.max(...runs[0].coordinates.map(([lng]) => lng))).toBeLessThan(0.5)
    expect(Math.min(...runs[1].coordinates.map(([lng]) => lng))).toBeGreaterThan(0.5)
  })

  it('returns [] for an empty band list', () => {
    expect(buildSlopeRuns(oneSeg, [])).toEqual([])
  })
})
```

- [ ] **Step 2: Run to verify it fails** — `npx jest src/elevation/__tests__/mapSlope.test.ts` → module not found.
- [ ] **Step 3: Implement** `buildSlopeRuns`. Walk samples grouped by segment; for each band, gather that band's same-segment sample coords plus interpolated boundary coords (interpolate `[lng,lat]` between the neighbouring same-segment samples that bracket `band.start`/`band.end`). Do NOT interpolate across a segment change.
- [ ] **Step 4: Run to verify it passes** — all mapSlope tests green.
- [ ] **Step 5: Commit** — `feat(elevation): map slope bands to coloured coordinate runs`.

---

### Task 2: Port — `colouredLines` on the overlay

**Files:**
- Modify: `src/map/provider/types.ts`

**Interfaces:**
- Produces: on `TrailOverlayProps` (and `RouteLineProps` if activities use `RouteLine`; confirm which draws the selected activity — see MapOverlays), add:
  ```ts
  // Optional per-slope coloured polylines; when set, drawn instead of the single-colour line.
  colouredLines?: { coordinates: [number, number][]; color: string }[]
  ```
  `GradeBand` MUST NOT appear here — this is generic coloured geometry.

> Seam task — no unit test; `npx tsc --noEmit` is the gate once the adapter consumes it (Task 3).

- [ ] **Step 1:** Add the optional field to the relevant overlay prop interface(s).
- [ ] **Step 2:** `npx tsc --noEmit` (will stay clean since it's optional).
- [ ] **Step 3: Commit** — `feat(map): coloured-polylines field on the trail overlay port`.

---

### Task 3: Adapter — data-driven `LineLayer`

**Files:**
- Modify: `src/map/providers/mapbox/adapter.tsx`

**Interfaces:**
- Consumes: `colouredLines` from the port (Task 2).
- Behaviour: when `colouredLines` is non-empty, render a single `Mapbox.ShapeSource` whose shape is a `FeatureCollection` of `LineString` features, each with `properties: { color }`, and a `Mapbox.LineLayer` styled `lineColor: ['get', 'color']`, `lineWidth`, `lineCap:'round'`, `lineJoin:'round'` — drawn in place of the plain single-colour line. Endpoints/arrows unchanged. When `colouredLines` is absent/empty, keep the current single-colour line exactly as today.

> Device-verified rendering; `npx tsc --noEmit` is the gate. Follow the existing `multiLine`/`ShapeSource`/`LineLayer` pattern in the file. Use a unique source/layer id (e.g. `trail-slope-source` / `trail-slope`).

- [ ] **Step 1:** Add the coloured-lines rendering branch to the overlay component in the adapter.
- [ ] **Step 2:** `npx tsc --noEmit` clean.
- [ ] **Step 3: Commit** — `feat(map): render slope-coloured trail line via data-driven lineColor`.

---

### Task 4: Shared wiring in `MapOverlays`

**Files:**
- Modify: `src/map/MapOverlays.tsx`

**Interfaces:**
- Consumes: `buildElevationProfile` (`../data/...`? — it's `src/elevation/profile`), `smoothProfile`/`slopeBands` (`../elevation/slope`), `buildSlopeRuns` (`../elevation/mapSlope`), `usePreferencesStore` (`elevationSmoothingMeters`), `useTheme`.
- Behaviour: for the route being drawn (trail or activity `segments`), build the profile → `smoothProfile(profile, smoothing)` → `slopeBands(smoothed, smoothing)` → `buildSlopeRuns(profile, bands)`; map each run's `band` → colour (steep/rough/uphill/downhill → theme tokens; **flat → the route's identity colour** `c.trailLine`/`c.activityLine`); pass `colouredLines={runs.map(r => ({ coordinates: r.coordinates, color: colourFor(r.band) }))}` to the overlay. If the profile is `null` (no elevation), pass nothing (plain identity-colour line as today). Memoize the derivation on `segments` + `smoothing`.

> Device-verified integration; `npx tsc --noEmit` + full `npx jest` are the gates. **Confirm decision (always-on, flat→identity colour) before implementing.**

- [ ] **Step 1:** Compute the coloured runs and pass `colouredLines` for the trail/activity route.
- [ ] **Step 2:** `npx tsc --noEmit` clean; `npx jest` green.
- [ ] **Step 3: Commit** — `feat(map): colour the selected route by slope`.

---

### Task 5: Verification

- [ ] **Step 1:** `npx tsc --noEmit` clean.
- [ ] **Step 2:** `npx jest` all green (new mapSlope suite included).
- [ ] **Step 3:** Seam audit — `grep -rn "@rnmapbox" src app | grep -v "src/map/providers/"` empty; confirm `GradeBand` does not appear in `src/map/provider/types.ts`.
- [ ] **Step 4: Device-verify:**
  - [ ] A trail with elevation shows a slope-coloured line; colours match the graph's bands.
  - [ ] Steep sections read clearly over satellite AND terrain.
  - [ ] Flat sections show the identity colour (trail purple / activity teal).
  - [ ] A multi-segment (paused) activity: the coloured line does NOT bridge the break.
  - [ ] A trail with no elevation falls back to the plain identity-colour line.

---

## Self-Review

**Spec coverage:** slope-coloured route → Tasks 1–4. Colour-only (no thickness) → no width variation anywhere. Break-safe → Task 1 test + Task 5 device check. Seam intact → Task 2 (generic field) + Task 5 audit. Reuse graph model → Task 4 (same profile/smoothing/bands). Flat→identity colour, always-on → Task 4 (decision flagged). Live track out of scope → untouched. ✓

**Placeholders:** none — Task 1 carries full test code; seam/adapter/wiring tasks carry concrete contracts and behaviour.

**Type consistency:** `SlopeRun`/`buildSlopeRuns` defined in Task 1 and consumed in Task 4; `colouredLines: {coordinates,color}[]` defined in Task 2, produced in Task 4, consumed in Task 3. `GradeBand` confined to elevation + MapOverlays' colour map, never the port.
