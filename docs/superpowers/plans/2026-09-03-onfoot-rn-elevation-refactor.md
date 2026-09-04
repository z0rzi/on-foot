# Elevation Feature Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Bring the (working) elevation-graph + slope-coloured-route feature to its clean final-design state: fix the one real correctness bug, unify a forked helper, and make route colouring extensible to a second metric (speed) — with no behaviour change except the bug fix.

**Architecture:** See `docs/superpowers/specs/2026-09-03-onfoot-rn-elevation-final-design.md`. Pure core in `src/elevation/`; map colouring flows through a metric-owning hook into a metric-agnostic `MapOverlays`; the provider seam is unchanged.

**Tech Stack:** TypeScript strict, react-native-svg, @rnmapbox behind the seam, Zustand, Jest.

## Global Constraints

- **No behaviour change** except fixing the multi-segment band bug. On-screen result otherwise identical.
- **Map-provider seam inviolable** — only `src/map/providers/mapbox/` imports the SDK; `GradeBand`/elevation concepts never reach `src/map/provider/types.ts` or `MapOverlays` after this refactor.
- **Pure logic TDD'd; rendering/hooks device-verified.**
- **YAGNI:** build the *seam* for speed-colouring, not speed itself. No metric registry, no `colourBy` enum.
- Minimal comments (why, not what). React Compiler is ON (gesture objects still `useMemo`; pure derivations don't).
- Keep tests green at every task.

---

### Task 1: Unify segment-scoped band geometry (fixes the multi-segment bug)

**Files:**
- Create: `src/elevation/bandGeometry.ts`, `src/elevation/__tests__/bandGeometry.test.ts`
- Modify: `src/elevation/svg.ts` (remove local `bandTopPoints`, consume `bandSamples`), `src/elevation/mapSlope.ts` (remove local `coordAt`/`segmentAt`, consume `bandSamples`)
- Modify tests: `src/elevation/__tests__/svg.test.ts` (add multi-segment coverage)

**The bug:** `svg.ts` resolves band-boundary elevation with the global `sampleAt(profile, dist)`, which crosses segments (a break carries zero distance). On multi-segment tracks each non-first band's left edge draws at the *previous* segment's ending elevation. `mapSlope.ts` already does it correctly per-segment. Unify both onto one helper.

**Interfaces:**
```ts
// bandGeometry.ts
import { ElevationProfile, ElevationSample } from './profile'
import { SlopeBand } from './slope'
// The band's samples within its OWN segment: an interpolated ElevationSample at band.start,
// the strictly-inner samples, and an interpolated ElevationSample at band.end. The band's
// segment is identified by its midpoint (per-segment distance ranges touch only at endpoints).
export function bandSamples(profile: ElevationProfile, band: SlopeBand): ElevationSample[]
```
`svg.ts`: `bandTopPoints(profile, band, scale)` → `bandSamples(...).map(s => [projectX(s.distance,profile,scale.width), projectY(s.ele,profile,scale.height)])`. `mapSlope.ts`: `buildSlopeRuns` → `bands.map(b => ({ band: b.band, coordinates: bandSamples(profile, b).map(s => [s.lng, s.lat]) }))`. Both skip a band whose `bandSamples` returns `< 2` points.

- [ ] **Step 1: Write the failing tests** for `bandSamples` — including the regression:

```ts
// src/elevation/__tests__/bandGeometry.test.ts
import { bandSamples } from '../bandGeometry'
import { buildElevationProfile } from '../profile'
import type { SlopeBand } from '../slope'

describe('bandSamples', () => {
  it('interpolates band boundaries within a single segment', () => {
    const p = buildElevationProfile([[
      { lat: 0, lng: 0, ele: 0 }, { lat: 0, lng: 0.001, ele: 100 },
    ]])!
    const s = bandSamples(p, { start: 0, end: p.totalDistance, band: 'steep' })
    expect(s[0].ele).toBeCloseTo(0, 6)
    expect(s[s.length - 1].ele).toBeCloseTo(100, 6)
  })

  it("uses the band's OWN segment start elevation on a multi-segment track (regression)", () => {
    // seg A ends at ele 160; seg B starts at ele 400. B's band must start at 400, not 160.
    const p = buildElevationProfile([
      [{ lat: 0, lng: 0, ele: 100 }, { lat: 0, lng: 0.001, ele: 160 }],
      [{ lat: 0, lng: 1, ele: 400 }, { lat: 0, lng: 1.001, ele: 420 }],
    ])!
    const D = p.samples[1].distance
    const bandB: SlopeBand = { start: D, end: p.totalDistance, band: 'rough' }
    const s = bandSamples(p, bandB)
    expect(s[0].ele).toBeCloseTo(400, 6)              // seg B's start, NOT 160
    expect(s[0].lng).toBeCloseTo(1, 6)                // and B's coordinates, not A's
    expect(s[s.length - 1].ele).toBeCloseTo(420, 6)
  })

  it('shares the boundary sample between adjacent same-segment bands', () => {
    const p = buildElevationProfile([[
      { lat: 0, lng: 0, ele: 0 }, { lat: 0, lng: 0.001, ele: 50 }, { lat: 0, lng: 0.002, ele: 60 },
    ]])!
    const mid = p.totalDistance / 2
    const a = bandSamples(p, { start: 0, end: mid, band: 'steep' })
    const b = bandSamples(p, { start: mid, end: p.totalDistance, band: 'uphill' })
    expect(b[0].ele).toBeCloseTo(a[a.length - 1].ele, 6)
    expect(b[0].lng).toBeCloseTo(a[a.length - 1].lng, 6)
  })
})
```

- [ ] **Step 2: Run to verify it fails** — `npx jest src/elevation/__tests__/bandGeometry.test.ts` → module not found.
- [ ] **Step 3: Implement `bandSamples`.** Group samples by segment (or precompute per-segment distance ranges); find the band's segment via its midpoint; `interpSample(segSamples, distance)` clamps and lerps every field (distance/ele/lat/lng, segment fixed); return `[interp(start), ...strictly-inner, interp(end)]`. (Port `coordAt`/`segmentAt` logic out of `mapSlope.ts` into here, generalised to a full `ElevationSample`.)
- [ ] **Step 4: Retarget `svg.ts` and `mapSlope.ts`** onto `bandSamples`; delete their local boundary helpers. Add a **multi-segment test to `svg.test.ts`** asserting the second band's first top-vertex y equals `projectY(segBStartEle, …)` (not the previous segment's).
- [ ] **Step 5: Run all elevation tests + tsc** — `npx jest src/elevation && npx tsc --noEmit` → green/clean.
- [ ] **Step 6: Commit** — `fix(elevation): resolve band boundaries within their own segment (multi-segment artifact)`.

---

### Task 2: Single band→colour map

**Files:**
- Create: `src/elevation/slopeColour.ts`
- Modify: `src/elevation/ElevationGraph.tsx` (use it in `fillColour`)

**Interfaces:**
```ts
// slopeColour.ts
import { GradeBand } from './profile'
import { AppColors } from '../theme/colors'
export function slopeBandColour(band: GradeBand, c: AppColors): string // steep/rough/uphill/downhill → tokens; flat → c.slopeFlat
```
`ElevationGraph.fillColour(band)` becomes: in-sheet flat → `c.panelBackground` (graph-only override), otherwise `slopeBandColour(band, c)`.

> No new unit test needed (thin pure map); `tsc` + existing device-verify cover it. Task 3 also consumes it.

- [ ] **Step 1:** Create `slopeColour.ts` with `slopeBandColour`.
- [ ] **Step 2:** Rewrite `ElevationGraph`'s `fillColour` to delegate (keeping the in-sheet flat override at the call site).
- [ ] **Step 3:** `npx tsc --noEmit` clean; `npx jest` green.
- [ ] **Step 4: Commit** — `refactor(elevation): single source for the slope band→colour map`.

---

### Task 3: Route colouring as a hook; MapOverlays becomes metric-agnostic

**Files:**
- Modify: `src/map/provider/types.ts` (name `ColouredLine`)
- Create: `src/elevation/useRouteColouring.ts`
- Modify: `src/map/MapOverlays.tsx` (accept `colouredLines` prop; drop all elevation imports + the inline pipeline + `slopeColour`), `src/map/MapCanvas.tsx` (call the hook, pass it down)

**Interfaces:**
```ts
// provider/types.ts
export interface ColouredLine { coordinates: [number, number][]; color: string }
// TrailOverlayProps.colouredLines?: ColouredLine[]  (replace the inline object type with the named one)

// useRouteColouring.ts
import type { OverlayRoute } from '../map/MapOverlays'   // or move OverlayRoute to avoid a cycle — see note
import type { ColouredLine } from '../map/provider/types'
// Slope-colours a route today (reads the smoothing preference internally). This hook OWNS the
// metric choice — future speed-colouring for activities branches HERE (route.kind), keeping the
// map seam metric-agnostic. Returns undefined when the route has no elevation (plain line).
export function useRouteColouring(route: OverlayRoute | null): ColouredLine[] | undefined
```
The hook does `buildElevationProfile(route.segments) → smoothProfile → slopeBands → buildSlopeRuns`, maps each run via `slopeBandColour(band, c)`, returns `ColouredLine[]` (or `undefined`). `MapOverlays` gains `colouredLines?: ColouredLine[]` as a prop and passes it straight to `TrailOverlay`; it no longer imports anything from `src/elevation` or `../settings`. `MapCanvas` calls `useRouteColouring(route)` and passes the result into `MapOverlays`.

Note on imports: if importing `OverlayRoute` from `MapOverlays` into the hook risks a cycle, move the `OverlayRoute` type to a small `src/map/overlayRoute.ts` (or keep the hook's param as `{ segments, kind } | null`). Pick the cleaner of the two; do not create a cycle.

> Architecture task. `tsc` + full `jest` are the gates; the seam grep must stay clean and `MapOverlays`/`provider/types.ts` must contain no `GradeBand`/elevation import. Device-verify that trail + activity lines still colour identically to before.

- [ ] **Step 1:** Name `ColouredLine` on the port; update `TrailOverlayProps` + the adapter's usage to the named type.
- [ ] **Step 2:** Create `useRouteColouring`; move the slope pipeline out of `MapOverlays` into it (using `slopeBandColour`).
- [ ] **Step 3:** Make `MapOverlays` accept `colouredLines` as a prop; remove its elevation/settings imports and the `slopeColour` helper. `MapCanvas` computes via the hook and passes down.
- [ ] **Step 4:** `npx tsc --noEmit` clean; `npx jest` green; `grep -rn "@rnmapbox" src app | grep -v "src/map/providers/" | grep -v "src/architecture/"` empty; confirm no `GradeBand`/`elevation` import in `MapOverlays.tsx` or `provider/types.ts`.
- [ ] **Step 5: Commit** — `refactor(map): route colouring via a metric-owning hook; MapOverlays metric-agnostic`.

---

### Task 4: Wiring + component polish

**Files:**
- Modify: `src/elevation/ElevationGraph.tsx`, `src/map/MapScreen.tsx`, `src/map/providers/mapbox/adapter.tsx`, and two test tightenings.

**Changes (each small, independent):**
- **`ElevationGraph`:** hoist `lineWidth`/`lineContrast` (pure `GradeBand`-only) to module scope; collapse the dead `plotWidth = width` alias to `width`; inline `{ width, height: PLOT_HEIGHT }` at the `useMemo` sites (or add `scale` to deps) so the memos are honest.
- **`MapScreen`:** derive the sheet-top offsets from one base — declare `graphBottom` (the fundamental `rootHeight - sheetTop`, with the single zero-guard), then `controlsAnimatedBottom = graphBottom + controlsSpacing`, then the lifted `controlsBottom`. Rename so the base vs lifted values aren't one word apart.
- **adapter:** extract the repeated casing colour literal (`'#333333'`) to a named module constant.
- **tests:** tighten `profile.test.ts` null-skip (assert distance ≈ two hops); strengthen the `mapSlope.test.ts` smoke assertion (or leave if the adjacency/break tests suffice — implementer's call, note it).

> `tsc` + full `jest` are the gates; behaviour unchanged.

- [ ] **Step 1:** Apply the `ElevationGraph` cleanups.
- [ ] **Step 2:** Apply the `MapScreen` offset dedup + rename.
- [ ] **Step 3:** adapter constant + test tightenings.
- [ ] **Step 4:** `npx tsc --noEmit` clean; `npx jest` green.
- [ ] **Step 5: Commit** — `refactor(elevation): hoist pure band maps; dedupe sheet-top offset; polish`.

---

### Task 5: Verification

- [ ] `npx tsc --noEmit` clean.
- [ ] `npx jest` all green (bandGeometry suite added; multi-segment coverage present).
- [ ] Seam grep empty (excluding `src/architecture/`); `MapOverlays.tsx` and `provider/types.ts` free of elevation imports / `GradeBand`.
- [ ] Dead-code sweep: `grep -rn "bandTopPoints\|coordAt\|slopeColour(" src` shows no orphans; every new export consumed.
- [ ] **Device-verify:** a **multi-segment (paused) activity** now shows correct per-segment bands (bug fixed); trail + activity map lines colour exactly as before; graph floating + in-sheet both unchanged; scrub + marker unchanged.

---

## Self-Review

**Spec coverage:** bug fix + fork unification → Task 1; single colour map → Task 2; extensibility (ColouredLine + hook + metric-agnostic MapOverlays) → Task 3; component/wiring polish + weak tests → Task 4; gates + device → Task 5. ✓
**Placeholders:** none — Task 1 carries full test code; others carry exact signatures + concrete steps.
**Type consistency:** `bandSamples` (Task 1) consumed by svg/mapSlope; `slopeBandColour` (Task 2) consumed by ElevationGraph + the hook (Task 3); `ColouredLine` (Task 3) named on the port, produced by the hook, consumed by adapter. No `GradeBand` past the seam.
