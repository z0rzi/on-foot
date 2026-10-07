# One Owner for Profile + Slope Banding — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Derive the elevation profile and its slope banding once per selected route instead of three times, giving the result a single owner.

**Architecture:** A pure `routeDisplay()` composes `buildElevationProfile` + `displaySlopeBands` into one `RouteDisplay` bundle. A thin `useRouteDisplay()` hook reads the smoothing preference and memoises it. `MapScreen` owns the single call; the bundle flows to `ElevationGraph` (through three forwarding sheets) and to `MapCanvas`. Both downstream consumers stop deriving anything.

**Tech Stack:** TypeScript 6, React 19.2.3, React Native 0.86.2 (Expo SDK 57), Jest 29 via jest-expo, zustand.

**Spec:** `docs/superpowers/specs/2026-10-07-route-display-design.md`

## Global Constraints

- **This is a pure refactor. Every pixel on screen must stay identical.** Any visible change is a bug, not an improvement.
- **Raw profile, smoothed bands.** `buildSlopeRuns(profile, bands)` and `buildBandTops(profile, bands, ...)` take the **raw** profile with bands derived from the **smoothed** one. Never pass `smoothed` to either — it compiles and silently changes what is drawn.
- **The live track stays a plain line.** Only a trail or activity route is slope-coloured. Logged separately as DUP-9; explicitly out of scope.
- **No JSDoc** (AGENTS.md). Comments explain *why*, never what changed.
- **Never reshape correct code to satisfy a linter.** A justified inline `eslint-disable` is a first-class outcome; an unjustifiable one is a real finding.
- `npm run verify` (tsc + jest + expo lint) must be green before any task is considered done.
- Commit subjects: lowercase, conventional-commit prefix, one line, no body.
- **Baseline before you start: 66 suites / 560 tests passing** (measured 2026-10-07, not quoted from memory). Task 1 adds 5 → 565. No other task changes the count.

---

### Task 1: The pure core — `routeDisplay()`

**Files:**
- Create: `src/elevation/routeDisplay.ts`
- Test: `src/elevation/__tests__/routeDisplay.test.ts`

**Interfaces:**
- Consumes: `buildElevationProfile`, `ElePoint`, `ElevationProfile` from `src/elevation/profile.ts`; `displaySlopeBands`, `SlopeBand` from `src/elevation/slope.ts`.
- Produces: `interface RouteDisplay { profile: ElevationProfile; smoothed: ElevationProfile; bands: SlopeBand[] }` and `routeDisplay(segments: ElePoint[][] | null, smoothingMeters: number): RouteDisplay | null`. Tasks 2-4 depend on both names exactly as spelled.

- [ ] **Step 1: Write the failing test**

Create `src/elevation/__tests__/routeDisplay.test.ts`. The `seg` helper matches the one in the sibling `slope.test.ts` — ~111 m between consecutive points at lat 0.

```ts
import { routeDisplay } from '../routeDisplay'
import { buildElevationProfile, ElePoint } from '../profile'
import { displaySlopeBands } from '../slope'

// ~111 m between consecutive points at lat 0 (0.001° lng).
const seg = (eles: number[]): ElePoint[] => eles.map((ele, i) => ({ lat: 0, lng: i * 0.001, ele }))

describe('routeDisplay', () => {
  it('returns null when there are no segments', () => {
    expect(routeDisplay(null, 0)).toBeNull()
  })

  it('returns null when the route has too few elevation samples to plot', () => {
    expect(routeDisplay([seg([100])], 0)).toBeNull()
  })

  it('returns null when the route covers no distance', () => {
    // Two samples at the same coordinate: a profile with no x-axis plots nothing.
    const stationary: ElePoint[] = [
      { lat: 0, lng: 0, ele: 100 },
      { lat: 0, lng: 0, ele: 110 },
    ]
    expect(routeDisplay([stationary], 0)).toBeNull()
  })

  it('bundles exactly what the profile and banding helpers produce separately', () => {
    const segments = [seg([100, 140, 180, 150, 100])]
    const profile = buildElevationProfile(segments)!
    expect(routeDisplay(segments, 0)).toEqual({ profile, ...displaySlopeBands(profile, 0) })
  })

  it('applies the smoothing window, so it reaches the band boundaries', () => {
    // A single-sample spike over a ~444 m track: unsmoothed it carves its own bands, while a
    // window wider than the track dissolves every run into one.
    const segments = [seg([100, 100, 130, 100, 100])]
    const sharp = routeDisplay(segments, 0)!
    const smooth = routeDisplay(segments, 500)!
    expect(sharp.bands.length).toBeGreaterThan(smooth.bands.length)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/elevation/__tests__/routeDisplay.test.ts`
Expected: FAIL — `Cannot find module '../routeDisplay'`.

- [ ] **Step 3: Write the minimal implementation**

Create `src/elevation/routeDisplay.ts`:

```ts
import { buildElevationProfile, type ElePoint, type ElevationProfile } from './profile'
import { displaySlopeBands, type SlopeBand } from './slope'

// The elevation view of one route: what is plotted, and where its colour bands fall. The raw
// profile carries the coordinates and the plotted line; the smoothed one exists only so the band
// boundaries and the scrubbed grade read from the same series the smoothing preference produced.
export interface RouteDisplay {
  profile: ElevationProfile
  smoothed: ElevationProfile
  bands: SlopeBand[]
}

export function routeDisplay(
  segments: ElePoint[][] | null,
  smoothingMeters: number,
): RouteDisplay | null {
  if (!segments) return null
  const profile = buildElevationProfile(segments)
  if (!profile) return null
  return { profile, ...displaySlopeBands(profile, smoothingMeters) }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/elevation/__tests__/routeDisplay.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/elevation/routeDisplay.ts src/elevation/__tests__/routeDisplay.test.ts
git commit -m "feat(elevation): bundle the profile and its slope banding in one value"
```

---

### Task 2: The hook, and `MapScreen` as its single owner

**Files:**
- Create: `src/map/useRouteDisplay.ts`
- Modify: `src/map/MapScreen.tsx` (imports at 1-27; `activeProfile` at 61-64; `showFloatingGraph`/`sheetProfile` at 67-68; sheet props at 81, 85, 91; graph at 147)

**Interfaces:**
- Consumes: `routeDisplay`, `RouteDisplay` (Task 1); `profileSegmentsFor` from `src/map/profileSource.ts`.
- Produces: `useRouteDisplay(mode: MapMode, trail: Trail | null, activity: Activity | null, livePoints: LiveTrackPoint[]): RouteDisplay | null`. In `MapScreen` the local `activeProfile` becomes `display` and `sheetProfile` becomes `sheetDisplay`; Tasks 3 and 4 read those names.

**Why there is no unit test for the hook:** this repo has no `renderHook` anywhere — verified across the whole tree, not just `src/`. Pure logic is TDD'd (Task 1 covers it); hooks and native rendering are device-verified. This follows `resolveLoad`/`useLoadedEntity` from backlog item 6 exactly. Do not add a testing-library dependency for this.

- [ ] **Step 1: Create the hook**

Create `src/map/useRouteDisplay.ts`:

```ts
import { useMemo } from 'react'
import { routeDisplay, type RouteDisplay } from '../elevation/routeDisplay'
import { usePreferencesStore } from '../settings/preferencesStore'
import { profileSegmentsFor } from './profileSource'
import type { MapMode } from '../store/mapStore'
import type { Trail } from '../data/trails/types'
import type { Activity, LiveTrackPoint } from '../data/activities/types'

// The one place the elevation view of the on-screen route is derived, and the only place the
// smoothing preference is read for display. Everything that draws the route or its graph takes
// the result from here, so the map and the graph can never disagree about where a band begins.
export function useRouteDisplay(
  mode: MapMode,
  trail: Trail | null,
  activity: Activity | null,
  livePoints: LiveTrackPoint[],
): RouteDisplay | null {
  const smoothing = usePreferencesStore((s) => s.elevationSmoothingMeters)
  return useMemo(
    () => routeDisplay(profileSegmentsFor(mode, trail, activity, livePoints), smoothing),
    [mode, trail, activity, livePoints, smoothing],
  )
}
```

- [ ] **Step 2: Point `MapScreen` at the hook**

In `src/map/MapScreen.tsx`, replace lines 61-64:

```tsx
  const activeProfile = useMemo(() => {
    const segments = profileSegmentsFor(mode, trail, activity, livePoints)
    return segments ? buildElevationProfile(segments) : null
  }, [mode, trail, activity, livePoints])
```

with:

```tsx
  const display = useRouteDisplay(mode, trail, activity, livePoints)
```

Then lines 67-68:

```tsx
  const showFloatingGraph = graphPlacement === 'floating' && display != null
  const sheetDisplay = graphPlacement === 'inSheet' ? display : null
```

`showFloatingGraph` must keep this exact shape. TypeScript narrows `display` to non-null at line 147 through this `const` alias; rewriting it as a function or a `let` breaks that narrowing and the file stops compiling.

- [ ] **Step 3: Keep the consumers compiling, unchanged**

Tasks 3 and 4 change the consumers' prop types. For now feed them the profile out of the bundle, so behaviour and types are untouched. At lines 81, 85 and 91 replace `profile={sheetProfile}` with:

```tsx
        profile={sheetDisplay?.profile ?? null}
```

and at line 147 replace `profile={activeProfile}` with:

```tsx
          <ElevationGraph profile={display.profile} placement="floating" animatedBottom={graphBottom} />
```

- [ ] **Step 4: Fix the imports**

In `src/map/MapScreen.tsx`:
- Line 1: `useMemo` is now unused — it appears nowhere else in the file. Change to `import { useEffect, useRef } from 'react'`.
- Line 22: delete `import { buildElevationProfile } from '../elevation/profile'`.
- Line 25: delete `import { profileSegmentsFor } from './profileSource'`.
- Add `import { useRouteDisplay } from './useRouteDisplay'`.
- Keep line 24 (`usePreferencesStore`): still used at line 59 for `elevationGraphPlacement`.

- [ ] **Step 5: Verify**

Run: `npm run verify`
Expected: green. 66 suites / 565 tests. No behaviour has changed yet — `MapScreen` now derives the bands too, but `ElevationGraph` and `useRouteColouring` still derive their own. That redundancy is removed in Tasks 3 and 4.

- [ ] **Step 6: Commit**

```bash
git add src/map/useRouteDisplay.ts src/map/MapScreen.tsx
git commit -m "refactor(map): give the route's elevation view a single owner"
```

---

### Task 3: `ElevationGraph` takes the bundle

**Files:**
- Modify: `src/elevation/ElevationGraph.tsx` (imports at 9-12; props at 31-39; derivation at 43-48; `scrubTo` deps at 76)
- Modify: `src/trails/TrailInfoSheet.tsx` (import at 12; props at 29-35; render at 144)
- Modify: `src/map/ActivityInfoSheet.tsx` (import at 14; prop at 18; type at 22; render at 45)
- Modify: `src/recording/RecordingInfoSheet.tsx` (import at 13; prop at 21; type at 25; render at 91)
- Modify: `src/map/MapScreen.tsx` (sheet props at 81, 85, 91; graph at 147)

**Interfaces:**
- Consumes: `RouteDisplay` (Task 1); `display`/`sheetDisplay` in `MapScreen` (Task 2).
- Produces: `ElevationGraph` prop `display: RouteDisplay` replaces `profile: ElevationProfile`. All three sheets take `display: RouteDisplay | null` in place of `profile: ElevationProfile | null`. Task 4 does not touch these.

This removes the third derivation (`ElevationGraph.tsx:48`) and the graph's own preference read.

- [ ] **Step 1: Change the graph's prop and drop its derivation**

In `src/elevation/ElevationGraph.tsx`, replace the component signature at lines 31-39:

```tsx
export function ElevationGraph({
  display,
  placement,
  animatedBottom,
}: {
  display: RouteDisplay
  placement: 'floating' | 'inSheet'
  animatedBottom?: SharedValue<number>
}) {
  const { profile, smoothed, bands } = display
  const c = useTheme()
  const insets = useSafeAreaInsets()
  const setPoint = useScrubStore((s) => s.setPoint)
  const [width, setWidth] = useState(0)
  const [cursor, setCursor] = useState<Cursor | null>(null)
  const floating = placement === 'floating'
```

Note what left: the `smoothing` line and the `displaySlopeBands` `useMemo` (old lines 43 and 48) are both gone. `profile`, `smoothed` and `bands` are now destructured from the prop, so every later use of those three names — the `tops` memo at 51-54, `scrubTo` at 63-77, its dependency array at 76 — stays exactly as written. Do not touch them.

- [ ] **Step 2: Fix the graph's imports**

In `src/elevation/ElevationGraph.tsx`:
- Line 9: delete `import { usePreferencesStore } from '../settings/preferencesStore'`.
- Line 11: `ElevationProfile` is no longer referenced — change to `import { GradeBand, sampleAt } from './profile'`.
- Line 12: delete `import { displaySlopeBands } from './slope'`.
- Add `import type { RouteDisplay } from './routeDisplay'`.
- Keep the `useMemo` import: still used by `tops`, `areas`, `bandLines` and `pan`.

- [ ] **Step 3: Change the three forwarding sheets**

All three only pass the value to `ElevationGraph`; none reads it. In each file, replace the `ElevationProfile` type import with:

```tsx
import type { RouteDisplay } from '../elevation/routeDisplay'
```

rename the destructured prop `profile` to `display`, change its type from `ElevationProfile | null` to `RouteDisplay | null`, and change the render line to:

```tsx
      {display && <ElevationGraph display={display} placement="inSheet" />}
```

- `src/trails/TrailInfoSheet.tsx`: import at line 12, prop at 31, type at 34, render at 144.
- `src/map/ActivityInfoSheet.tsx`: import at line 14, prop at 18, type at 22, render at 45.
- `src/recording/RecordingInfoSheet.tsx`: import at line 13, prop at 21, type at 25, render at 91.

- [ ] **Step 4: Update `MapScreen`'s call sites**

In `src/map/MapScreen.tsx`, replace the three `profile={sheetDisplay?.profile ?? null}` props added in Task 2 with:

```tsx
        display={sheetDisplay}
```

and the floating graph at line 147 with:

```tsx
          <ElevationGraph display={display} placement="floating" animatedBottom={graphBottom} />
```

- [ ] **Step 5: Verify**

Run: `npm run verify`
Expected: green, 66 suites / 565 tests. If `tsc` reports that `display` is possibly `null` at the floating graph, `showFloatingGraph` was rewritten in a way that broke aliased-condition narrowing — restore the exact `const` form from Task 2 Step 2 rather than adding a non-null assertion.

- [ ] **Step 6: Commit**

```bash
git add src/elevation/ElevationGraph.tsx src/trails/TrailInfoSheet.tsx src/map/ActivityInfoSheet.tsx src/recording/RecordingInfoSheet.tsx src/map/MapScreen.tsx
git commit -m "refactor(elevation): the graph takes the derived view instead of rebuilding it"
```

---

### Task 4: `useRouteColouring` takes the bundle

**Files:**
- Modify: `src/elevation/useRouteColouring.ts` (whole file)
- Modify: `src/map/MapCanvas.tsx` (import at 14; signature at 21; `colouredLines` at 69)
- Modify: `src/map/MapScreen.tsx` (`MapCanvas` render at 105)

**Interfaces:**
- Consumes: `RouteDisplay` (Task 1); `display` in `MapScreen` (Task 2).
- Produces: `useRouteColouring(display: RouteDisplay | null): ColouredLine[] | undefined`. `MapCanvas` gains a third prop, `display: RouteDisplay | null`.

This removes the second derivation (`useRouteColouring.ts:18-27`), which was rebuilding both the profile and the banding from segments.

- [ ] **Step 1: Rewrite the hook**

Replace the whole of `src/elevation/useRouteColouring.ts`:

```ts
import { useMemo } from 'react'
import type { ColouredLine } from '../map/provider/types'
import { useTheme } from '../theme/useTheme'
import { buildSlopeRuns } from './mapSlope'
import { slopeBandColour } from './slopeColour'
import type { RouteDisplay } from './routeDisplay'

// Slope-colours a route today. This hook OWNS the metric choice — future speed-colouring for
// activities branches HERE, keeping the map seam metric-agnostic. The bands arrive already
// derived, so the colours and the graph can never disagree. Returns undefined when there is
// nothing to colour (no route, or a route with no elevation), which draws a plain line.
export function useRouteColouring(display: RouteDisplay | null): ColouredLine[] | undefined {
  const c = useTheme()

  return useMemo(() => {
    if (!display) return undefined
    return buildSlopeRuns(display.profile, display.bands).map((r) => ({
      coordinates: r.coordinates,
      color: slopeBandColour(r.band, c),
    }))
  }, [display, c])
}
```

Gone with it: the `usePreferencesStore`, `buildElevationProfile`, `displaySlopeBands` and `GpxPoint` imports. The old comment claimed the hook "reads the smoothing preference internally" — that is no longer true, so it is rewritten above rather than left to rot.

`buildSlopeRuns` takes `display.profile` (raw) with `display.bands` (from the smoothed series). That asymmetry is the behaviour contract — see Global Constraints.

- [ ] **Step 2: Give `MapCanvas` the prop**

In `src/map/MapCanvas.tsx`, change the signature at line 21:

```tsx
export function MapCanvas({
  trail,
  activity,
  display,
}: {
  trail: Trail | null
  activity: Activity | null
  display: RouteDisplay | null
}) {
```

and add to the imports:

```tsx
import type { RouteDisplay } from '../elevation/routeDisplay'
```

- [ ] **Step 3: Gate the colouring on there being a route**

Replace line 69:

```tsx
  const colouredLines = useRouteColouring(route ? display : null)
```

The `route ? ... : null` is load-bearing, not defensive. During a recording with no trail selected, `display` is the live track's profile while `route` is null — passing `display` unguarded would hand coloured lines to a map that is drawing the live track, which is DUP-9's territory and explicitly out of scope. Keep the gate.

- [ ] **Step 4: Pass it from `MapScreen`**

In `src/map/MapScreen.tsx`, line 105:

```tsx
        <MapCanvas trail={trailToShow(mode, trail)} activity={mode === 'activity' ? activity : null} display={display} />
```

- [ ] **Step 5: Verify**

Run: `npm run verify`
Expected: green, 66 suites / 565 tests. The profile and banding are now derived exactly once per selection.

- [ ] **Step 6: Commit**

```bash
git add src/elevation/useRouteColouring.ts src/map/MapCanvas.tsx src/map/MapScreen.tsx
git commit -m "refactor(elevation): colour the route from the derived view, not from segments"
```

---

### Task 5: Close the findings in the record

**Files:**
- Modify: `docs/reviews/2026-09-10-full-review.md` (DUP-2 at 106-116; PERF-2 at 339-341; backlog row 7 at 463; dashboard row 48)
- Modify: `docs/reviews/2026-10-06-open-work.md` (backlog table; "Closed below"; the counts in the header)

**Interfaces:** none — documentation only.

**Do not start this task until the device verification below has been run and has passed.** The review document must never assert something unverified. If device verification has not happened yet, stop and say so rather than ticking the rows.

- [ ] **Step 1: Confirm the whole gate is green**

Run: `npm run verify`
Expected: green, 66 suites / 565 tests.

- [ ] **Step 2: Tick the findings in the authoritative review**

In `docs/reviews/2026-09-10-full-review.md`:
- Append to the DUP-2 paragraph, in the style the other closed findings use: `· **Done** (<commit>): derived once in `useRouteDisplay`; `ElevationGraph` and `useRouteColouring` both take the derived `RouteDisplay`.`
- Append the same `**Done**` note to PERF-2.
- Change backlog row 7's final cell from `next` to `**done** — <commit>`, and strike the row's Work cell with `~~...~~` as rows 1-6 do.
- Dashboard row 48 ("Duplication & drift"): remove `profile+banding derived three times;` from the summary and drop the should-fix count from `0 / 2 / 7` to `0 / 1 / 7`.

- [ ] **Step 3: Update the maintained index**

In `docs/reviews/2026-10-06-open-work.md`:
- Remove row 7 from the backlog table, leaving rows 8-10.
- Add a "Closed below" entry, newest first, naming what changed and the commit.
- Correct the header counts: DUP-2 and PERF-2 both close, so **twenty-six** open findings becomes **twenty-four**, and **ten of them are in the table** becomes **eight**. The sixteen outside the table are unchanged — neither DUP-2 nor PERF-2 was among them.
- In the "Proposed work" section, update the progressive-rendering entry: item 7 is no longer a prerequisite to wait on, and the measurement it asks for is now cheap because `useRouteDisplay` is the single place to instrument.

- [ ] **Step 4: Commit**

```bash
git add docs/reviews/2026-09-10-full-review.md docs/reviews/2026-10-06-open-work.md
git commit -m "docs(reviews): close DUP-2 and PERF-2, backlog row 7 is done"
```

---

## Device verification

Map rendering and the graph are not unit-tested, so this is the real gate. Run it after Task 4 and before Task 5. **Every one of these must look exactly as it did before the change** — this is a pure refactor.

1. **Select a trail from the Trails list.** The route draws slope-coloured, and the elevation graph shows the same bands in the same places.
2. **Select an activity.** Same, with the activity's own colouring.
3. **Open an activity with a linked trail and follow the link.** The trail appears, coloured, with its graph.
4. **Start a recording with no trail selected.** The graph shows live elevation and colours as you move; the live track on the map stays a **plain** line — unchanged, and deliberately so (DUP-9).
5. **Start a recording with a trail selected.** The trail is coloured, its graph is shown, and the live track is plain.
6. **Change the elevation smoothing preference** (Settings) while a trail is selected. The bands must move **on the route and in the graph together** — this is the single most valuable check in the list, because a split derivation is exactly what would let them disagree.
7. **Switch the graph between floating and in-sheet placement.** Both render; the floating one sits flush on the sheet's top edge and the controls ride above it.
8. **Scrub the graph.** The tooltip shows elevation, distance and grade, and the marker tracks along the route on the map.

A subjective note worth taking while you are there: trail selection should feel quicker on a long trail. It will not be instant — the full-geometry read and the map layer rebuild are untouched.
