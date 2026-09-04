# Elevation Graph Refinements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the elevation graph's noisy colour pipeline with a smoothed, slope-segmented one; make the graph background transparent; add a Y-axis; and make the smoothing window user-configurable in Settings.

**Architecture:** Two deliberately separate representations. The **accurate profile** (`buildElevationProfile`, unchanged) drives the elevation line and the tooltip's elevation. A new **smoothed slope** module (`slope.ts`, replacing the deleted `bins.ts`) drives colour: `smoothProfile` (moving-average over a distance window, per-segment) → `slopeBands` (contiguous constant-slope runs in distance space, short runs dissolved). `buildBandAreas` fills under the accurate line, coloured by the smoothed bands. A Y-axis (`buildAxisTicks`) and transparent, haloed rendering complete the visual. The smoothing window lives in `preferencesStore` and a Settings-tab control.

**Tech Stack:** TypeScript (strict), react-native-svg 15, react-native-gesture-handler 2.32, react-native-reanimated 4.5, Zustand (+persist), Jest (jest-expo). No new dependencies.

## Global Constraints

- **No new dependencies** — svg, gesture-handler, reanimated, zustand/persist, AsyncStorage all already present.
- **Pure logic is TDD'd first; native rendering/gestures are device-verified** (`src/**/__tests__/`).
- **Comments are minimal** — self-documenting; describe current state, not the change.
- **React Compiler is ON** — don't hand-add `useMemo` to pure derivations, BUT keep the existing gesture `useMemo` + `.runOnJS(true)` discipline (see `MapControls.tsx`); read per-frame-changing values imperatively, not by closure.
- **Slope bands** (grade = rise ÷ run, %): `>25` steep, `>12..25` rough, `>4..12` uphill, `-4..4` flat (NO fill), `<-4` downhill. `gradeBand` already exists in `src/elevation/profile.ts` — reuse it.
- **Clean redesign, not patch:** `src/elevation/bins.ts` and its test are DELETED; colour comes from `slope.ts`. No fixed-width pixel bins, no MAX-grade anywhere.
- **Decisions:** flat sections render nothing (transparent to map); line stays accurate (raw); smoothing default 50 m, configurable.
- **The elevation line and the scrub tooltip's elevation come from the RAW profile; the colours and the tooltip's grade come from the SMOOTHED profile.**

---

### Task 1: Elevation smoothing (`smoothProfile`)

**Files:**
- Create: `src/elevation/slope.ts`
- Test: `src/elevation/__tests__/slope.test.ts`

**Interfaces:**
- Consumes: `ElevationProfile`, `ElevationSample` from `./profile`.
- Produces:
  ```ts
  export function smoothProfile(profile: ElevationProfile, windowMeters: number): ElevationProfile
  ```
  Each output sample keeps its `distance`/`lat`/`lng`/`segment`; its `ele` becomes the mean of the elevations of **same-segment** samples whose distance is within `[d - windowMeters/2, d + windowMeters/2]`. `windowMeters <= 0` returns the profile unchanged (smoothing "Off"). `minEle`/`maxEle`/`totalDistance` are recomputed from the smoothed samples (`totalDistance` is unchanged since distances are preserved).

- [ ] **Step 1: Write the failing tests**

```ts
// src/elevation/__tests__/slope.test.ts
import { smoothProfile } from '../slope'
import { buildElevationProfile, ElePoint } from '../profile'

// ~111 m between consecutive points at lat 0 (0.001° lng).
const seg = (eles: number[]): ElePoint[] => eles.map((ele, i) => ({ lat: 0, lng: i * 0.001, ele }))

describe('smoothProfile', () => {
  it('windowMeters <= 0 returns the profile unchanged', () => {
    const p = buildElevationProfile([seg([100, 130, 110])])!
    expect(smoothProfile(p, 0)).toEqual(p)
  })

  it('averages out a single-sample spike toward its neighbours', () => {
    // Flat 100 m line with one +30 m spike in the middle; a wide window pulls the spike down.
    const p = buildElevationProfile([seg([100, 100, 130, 100, 100])])!
    const s = smoothProfile(p, 500) // window spans the whole track
    const mid = s.samples[2].ele
    expect(mid).toBeLessThan(130)
    expect(mid).toBeGreaterThan(100)
    expect(s.maxEle).toBeLessThan(130) // recomputed from smoothed eles
  })

  it('does not average across a segment break', () => {
    // Segment A flat at 100, segment B flat at 200; smoothing must not bleed B into A.
    const a = seg([100, 100])
    const b: ElePoint[] = [{ lat: 0, lng: 1, ele: 200 }, { lat: 0, lng: 1.001, ele: 200 }]
    const p = buildElevationProfile([a, b])!
    const s = smoothProfile(p, 100000) // huge window — would merge if segments weren't respected
    expect(s.samples[0].ele).toBe(100)
    expect(s.samples[1].ele).toBe(100)
    expect(s.samples[2].ele).toBe(200)
    expect(s.samples[3].ele).toBe(200)
  })

  it('preserves distances, coordinates and segment tags', () => {
    const p = buildElevationProfile([seg([100, 120, 140])])!
    const s = smoothProfile(p, 50)
    expect(s.samples.map((x) => x.distance)).toEqual(p.samples.map((x) => x.distance))
    expect(s.samples.map((x) => x.segment)).toEqual(p.samples.map((x) => x.segment))
    expect(s.samples.map((x) => x.lng)).toEqual(p.samples.map((x) => x.lng))
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/elevation/__tests__/slope.test.ts`
Expected: FAIL — `Cannot find module '../slope'`.

- [ ] **Step 3: Implement**

```ts
// src/elevation/slope.ts
import { ElevationProfile, ElevationSample } from './profile'

export function smoothProfile(profile: ElevationProfile, windowMeters: number): ElevationProfile {
  if (windowMeters <= 0) return profile
  const half = windowMeters / 2
  const src = profile.samples
  const samples: ElevationSample[] = src.map((sample, i) => {
    let sum = 0
    let count = 0
    for (let j = i; j >= 0 && sample.distance - src[j].distance <= half; j--) {
      if (src[j].segment !== sample.segment) break
      sum += src[j].ele
      count++
    }
    for (let j = i + 1; j < src.length && src[j].distance - sample.distance <= half; j++) {
      if (src[j].segment !== sample.segment) break
      sum += src[j].ele
      count++
    }
    return { ...sample, ele: sum / count }
  })
  let minEle = Infinity
  let maxEle = -Infinity
  for (const s of samples) {
    if (s.ele < minEle) minEle = s.ele
    if (s.ele > maxEle) maxEle = s.ele
  }
  return { samples, minEle, maxEle, totalDistance: profile.totalDistance }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest src/elevation/__tests__/slope.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/elevation/slope.ts src/elevation/__tests__/slope.test.ts
git commit -m "feat(elevation): moving-average elevation smoothing over a distance window"
```

---

### Task 2: Slope band segmentation (`slopeBands`)

**Files:**
- Modify: `src/elevation/slope.ts` (append)
- Test: `src/elevation/__tests__/slope.test.ts` (append)

**Interfaces:**
- Consumes: `ElevationProfile`, `GradeBand`, `gradeBand` from `./profile`.
- Produces:
  ```ts
  export interface SlopeBand { start: number; end: number; band: GradeBand }
  export function slopeBands(smoothed: ElevationProfile, minRunMeters: number): SlopeBand[]
  ```
  Computes grade per consecutive **same-segment** pair of the (already smoothed) profile → `gradeBand` → contiguous runs coalesced by band. Runs shorter than `minRunMeters` are dissolved into their longer neighbour (ties → previous), then re-coalesced, until every run is `>= minRunMeters` or only one remains. Runs never span a segment break (a break's zero-length pair is skipped, breaking the run). `minRunMeters <= 0` disables merging.

- [ ] **Step 1: Write the failing tests** (append to `slope.test.ts`)

```ts
import { slopeBands } from '../slope'

describe('slopeBands', () => {
  it('a uniform slope is a single band', () => {
    const p = buildElevationProfile([seg([0, 44, 88, 132])])! // ~40% throughout → steep
    const bands = slopeBands(p, 0)
    expect(bands).toHaveLength(1)
    expect(bands[0].band).toBe('steep')
    expect(bands[0].start).toBe(0)
    expect(bands[0].end).toBeCloseTo(p.totalDistance, 6)
  })

  it('a descent with a tiny up-bump reads as one downhill band (the device-feedback case)', () => {
    // Net descent 200→100 with one +2 m blip. Smoothed first, then banded → all downhill,
    // no stray uphill/orange run.
    const p = smoothProfile(buildElevationProfile([seg([200, 170, 172, 140, 110])])!, 400)
    const bands = slopeBands(p, 200)
    expect(bands.every((b) => b.band === 'downhill')).toBe(true)
  })

  it('dissolves a short run into its longer neighbour', () => {
    // Long steep climb, a very short flat notch, then more steep climb. With minRun larger than
    // the notch, the whole thing is one steep band.
    const p = buildElevationProfile([seg([0, 44, 88, 88.5, 132, 176])])!
    const withMerge = slopeBands(p, p.totalDistance) // minRun = whole track → forces a single run
    expect(withMerge).toHaveLength(1)
    expect(withMerge[0].band).toBe('steep')
  })

  it('does not merge across a segment break', () => {
    const aUp: ElePoint[] = [{ lat: 0, lng: 0, ele: 0 }, { lat: 0, lng: 0.001, ele: 44 }]   // steep
    const bDown: ElePoint[] = [{ lat: 0, lng: 1, ele: 100 }, { lat: 0, lng: 1.001, ele: 56 }] // steep down
    const p = buildElevationProfile([aUp, bDown])!
    const bands = slopeBands(p, 0)
    expect(bands.map((b) => b.band)).toEqual(['steep', 'downhill'])
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/elevation/__tests__/slope.test.ts -t slopeBands`
Expected: FAIL — `slopeBands is not a function`.

- [ ] **Step 3: Implement** (append to `slope.ts`)

```ts
import { GradeBand, gradeBand } from './profile'

export interface SlopeBand { start: number; end: number; band: GradeBand }

export function slopeBands(smoothed: ElevationProfile, minRunMeters: number): SlopeBand[] {
  const s = smoothed.samples
  const runs: SlopeBand[] = []
  for (let i = 1; i < s.length; i++) {
    const a = s[i - 1]
    const b = s[i]
    if (a.segment !== b.segment) continue
    const span = b.distance - a.distance
    if (span <= 0) continue
    const band = gradeBand(((b.ele - a.ele) / span) * 100)
    const last = runs[runs.length - 1]
    if (last && last.band === band && last.end === a.distance) last.end = b.distance
    else runs.push({ start: a.distance, end: b.distance, band })
  }
  return minRunMeters <= 0 ? runs : dissolveShortRuns(runs, minRunMeters)
}

// Repeatedly fold the shortest sub-threshold run into its longer neighbour (ties → previous),
// re-coalescing equal-band neighbours, until every run meets the length floor or one remains.
function dissolveShortRuns(runs: SlopeBand[], minRunMeters: number): SlopeBand[] {
  let current = runs
  while (current.length > 1) {
    let idx = -1
    let shortest = Infinity
    for (let i = 0; i < current.length; i++) {
      const len = current[i].end - current[i].start
      if (len < minRunMeters && len < shortest) {
        shortest = len
        idx = i
      }
    }
    if (idx === -1) break
    const prev = current[idx - 1]
    const next = current[idx + 1]
    // Extend the longer neighbour (its band wins) over the dropped short run, then re-coalesce.
    const target = !next || (prev && prev.end - prev.start >= next.end - next.start) ? prev : next
    if (target === prev) prev.end = current[idx].end
    else next.start = current[idx].start
    current = coalesce(current.filter((_, i) => i !== idx))
  }
  return current
}

function coalesce(runs: SlopeBand[]): SlopeBand[] {
  const out: SlopeBand[] = []
  for (const run of runs) {
    const last = out[out.length - 1]
    if (last && last.band === run.band && last.end === run.start) last.end = run.end
    else out.push({ ...run })
  }
  return out
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest src/elevation/__tests__/slope.test.ts`
Expected: PASS (all smoothProfile + slopeBands tests).

- [ ] **Step 5: Commit**

```bash
git add src/elevation/slope.ts src/elevation/__tests__/slope.test.ts
git commit -m "feat(elevation): segment the smoothed profile into slope bands"
```

---

### Task 3: Y-axis ticks (`buildAxisTicks`)

**Files:**
- Modify: `src/elevation/svg.ts` (append)
- Test: `src/elevation/__tests__/svg.test.ts` (append)

**Interfaces:**
- Consumes: `ElevationProfile`, `projectY` (both already in `svg.ts`/`profile.ts`).
- Produces:
  ```ts
  export interface AxisTick { ele: number; y: number }
  export function buildAxisTicks(profile: ElevationProfile, height: number, targetCount: number): AxisTick[]
  ```
  Chooses a "nice" step (1/2/5·10ⁿ) so roughly `targetCount` ticks fall within `[minEle, maxEle]`, emits each round elevation with its `y = projectY(ele, profile, height)`. A flat-elevation profile (`maxEle === minEle`) yields a single tick at that elevation.

- [ ] **Step 1: Write the failing tests** (append to `svg.test.ts`)

```ts
import { buildAxisTicks } from '../svg'

describe('buildAxisTicks', () => {
  const profile = buildElevationProfile([[
    { lat: 0, lng: 0, ele: 739 },
    { lat: 0, lng: 0.01, ele: 995 },
  ]])!

  it('emits round elevations within [min, max] with inverted y', () => {
    const ticks = buildAxisTicks(profile, 100, 3)
    expect(ticks.length).toBeGreaterThanOrEqual(2)
    for (const t of ticks) {
      expect(t.ele).toBeGreaterThanOrEqual(739)
      expect(t.ele).toBeLessThanOrEqual(995)
      expect(t.ele % 50).toBe(0) // round to a nice step
    }
    // Higher elevation → smaller y (inverted).
    const sorted = [...ticks].sort((a, b) => a.ele - b.ele)
    expect(sorted[0].y).toBeGreaterThan(sorted[sorted.length - 1].y)
  })

  it('a flat-elevation profile yields a single tick', () => {
    const flat = buildElevationProfile([[
      { lat: 0, lng: 0, ele: 500 }, { lat: 0, lng: 0.001, ele: 500 },
    ]])!
    const ticks = buildAxisTicks(flat, 80, 3)
    expect(ticks).toHaveLength(1)
    expect(ticks[0].ele).toBe(500)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/elevation/__tests__/svg.test.ts -t buildAxisTicks`
Expected: FAIL — `buildAxisTicks is not a function`.

- [ ] **Step 3: Implement** (append to `svg.ts`)

```ts
export interface AxisTick { ele: number; y: number }

function niceStep(raw: number): number {
  const pow = Math.pow(10, Math.floor(Math.log10(raw)))
  const n = raw / pow
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10
  return nice * pow
}

export function buildAxisTicks(profile: ElevationProfile, height: number, targetCount: number): AxisTick[] {
  const range = profile.maxEle - profile.minEle
  if (range <= 0) return [{ ele: profile.minEle, y: projectY(profile.minEle, profile, height) }]
  const step = niceStep(range / targetCount)
  const first = Math.ceil(profile.minEle / step) * step
  const ticks: AxisTick[] = []
  for (let ele = first; ele <= profile.maxEle + 1e-9; ele += step) {
    ticks.push({ ele, y: projectY(ele, profile, height) })
  }
  return ticks
}
```

(`ElevationProfile` and `projectY` are already imported/defined in `svg.ts`.)

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest src/elevation/__tests__/svg.test.ts`
Expected: PASS (existing svg tests + buildAxisTicks).

- [ ] **Step 5: Commit**

```bash
git add src/elevation/svg.ts src/elevation/__tests__/svg.test.ts
git commit -m "feat(elevation): nice-numbered Y-axis ticks"
```

---

### Task 4: Smoothing preference (`elevationSmoothingMeters`)

**Files:**
- Modify: `src/settings/preferencesStore.ts`
- Test: `src/settings/__tests__/preferencesStore.test.ts` (create if absent)

**Interfaces:**
- Produces on `usePreferencesStore`:
  ```ts
  elevationSmoothingMeters: number            // default 50, persisted
  setElevationSmoothing: (meters: number) => void
  export const ELEVATION_SMOOTHING_PRESETS: readonly number[] // [0, 25, 50, 100, 200]
  ```
  `0` means "Off". The value is added to the persisted `partialize` set alongside `paceSpeedMode`.

- [ ] **Step 1: Write the failing test**

```ts
// src/settings/__tests__/preferencesStore.test.ts
import { usePreferencesStore, ELEVATION_SMOOTHING_PRESETS } from '../preferencesStore'

beforeEach(() => usePreferencesStore.setState({ elevationSmoothingMeters: 50 }))

describe('elevation smoothing preference', () => {
  it('defaults to 50 m', () => {
    expect(usePreferencesStore.getState().elevationSmoothingMeters).toBe(50)
  })
  it('setElevationSmoothing updates the value', () => {
    usePreferencesStore.getState().setElevationSmoothing(100)
    expect(usePreferencesStore.getState().elevationSmoothingMeters).toBe(100)
  })
  it('exposes presets including Off (0) and the 50 m default', () => {
    expect(ELEVATION_SMOOTHING_PRESETS).toContain(0)
    expect(ELEVATION_SMOOTHING_PRESETS).toContain(50)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/settings/__tests__/preferencesStore.test.ts`
Expected: FAIL — `ELEVATION_SMOOTHING_PRESETS` undefined / property missing.

- [ ] **Step 3: Implement**

Edit `src/settings/preferencesStore.ts`:

```ts
export const ELEVATION_SMOOTHING_PRESETS = [0, 25, 50, 100, 200] as const
```

Add to the `PreferencesStore` interface:

```ts
  elevationSmoothingMeters: number
  setElevationSmoothing: (meters: number) => void
```

Add to the store initializer (alongside `paceSpeedMode`):

```ts
      elevationSmoothingMeters: 50,
      setElevationSmoothing: (meters) => set({ elevationSmoothingMeters: meters }),
```

Extend `partialize`:

```ts
      partialize: (s) => ({
        paceSpeedMode: s.paceSpeedMode,
        elevationSmoothingMeters: s.elevationSmoothingMeters,
      }),
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest src/settings/__tests__/preferencesStore.test.ts && npx tsc --noEmit`
Expected: PASS + clean.

- [ ] **Step 5: Commit**

```bash
git add src/settings/preferencesStore.ts src/settings/__tests__/preferencesStore.test.ts
git commit -m "feat(settings): persisted elevation-smoothing-window preference"
```

---

### Task 5: Retarget `buildBandAreas` to `SlopeBand[]`

**Files:**
- Modify: `src/elevation/svg.ts`
- Modify: `src/elevation/__tests__/svg.test.ts` (buildBandAreas tests → literal `SlopeBand` fixtures, drop the `bins` import)

**Interfaces:**
- Consumes: `SlopeBand` from `./slope` (Task 2).
- Changes: `buildBandAreas(profile, bins: ColorBin[], scale)` → `buildBandAreas(profile, bands: SlopeBand[], scale)`. Behaviour is unchanged (fill under the accurate line, skip `flat`); only the parameter type name changes. `SlopeBand` and `ColorBin` are structurally identical, so existing callers still typecheck — `bins.ts` is not deleted until Task 6.

Why now: this makes `svg.ts` depend on `slope.ts` instead of `bins.ts`, and lets `svg.test.ts` stop importing `bins`, so `bins.ts` can be deleted cleanly in Task 6.

- [ ] **Step 1: Update the buildBandAreas tests to use literal SlopeBand fixtures**

In `src/elevation/__tests__/svg.test.ts`, replace the `buildColorBins(...)` calls inside the `buildBandAreas` describe with literal band arrays, and change the import so `buildColorBins`/`bins` is no longer referenced. For example the "emits a closed filled polygon per non-flat bin" test becomes:

```ts
import type { SlopeBand } from '../slope'
// ...
  it('emits a closed filled polygon per non-flat band', () => {
    const bands: SlopeBand[] = [{ start: 0, end: oneSeg.totalDistance, band: 'steep' }]
    const areas = buildBandAreas(oneSeg, bands, { width: 200, height: 50 })
    expect(areas).toHaveLength(1)
    expect(areas[0].band).toBe('steep')
    expect(areas[0].d.startsWith('M ')).toBe(true)
    expect(areas[0].d.trim().endsWith('Z')).toBe(true)
  })

  it('skips flat bands (they render as empty)', () => {
    const bands: SlopeBand[] = [{ start: 0, end: 100, band: 'flat' }]
    expect(buildBandAreas(oneSeg, bands, { width: 200, height: 50 })).toEqual([])
  })
```

Remove the now-unused `import { buildColorBins } from '../bins'` line from this test file.

- [ ] **Step 2: Run to verify the tests fail as written**

Run: `npx jest src/elevation/__tests__/svg.test.ts`
Expected: FAIL (or type error) — `SlopeBand` not accepted / import shape mismatch — until the signature is updated.

- [ ] **Step 3: Retarget the signature**

In `src/elevation/svg.ts`, change the `buildBandAreas` parameter type from `ColorBin[]` to `SlopeBand[]` and update the import: remove `import { ColorBin } from './bins'`, add `import { SlopeBand } from './slope'`. The function body is unchanged (it only reads `.start`, `.end`, `.band`).

```ts
import { SlopeBand } from './slope'
// ...
export function buildBandAreas(profile: ElevationProfile, bands: SlopeBand[], scale: PlotScale): BandArea[] {
  // ...unchanged body, iterating `bands`...
}
```

- [ ] **Step 4: Run to verify it passes + typecheck**

Run: `npx jest src/elevation/__tests__/svg.test.ts && npx tsc --noEmit`
Expected: PASS + clean (ElevationGraph still compiles: `buildColorBins` returns `ColorBin[]`, structurally assignable to `SlopeBand[]`).

- [ ] **Step 5: Commit**

```bash
git add src/elevation/svg.ts src/elevation/__tests__/svg.test.ts
git commit -m "refactor(elevation): buildBandAreas consumes SlopeBand from the slope module"
```

---

### Task 6: ElevationGraph rework + delete `bins.ts`

**Files:**
- Modify: `src/elevation/ElevationGraph.tsx`
- Delete: `src/elevation/bins.ts`, `src/elevation/__tests__/bins.test.ts`

**Interfaces:**
- Consumes: `smoothProfile`, `slopeBands` (`./slope`); `buildBandAreas`, `buildLinePaths`, `buildAxisTicks` (`./svg`); `sampleAt` (`./profile`); `usePreferencesStore` (`../settings/preferencesStore`); `useScrubStore`; theme slope tokens.
- Produces: unchanged export surface (`GRAPH_HEIGHT`, `ElevationGraph({ profile, animatedBottom })`).

**Behaviour changes:**
1. Read `smoothing = usePreferencesStore((s) => s.elevationSmoothingMeters)`.
2. `smoothed = useMemo(() => smoothProfile(profile, smoothing), [profile, smoothing])`.
3. `bands = useMemo(() => slopeBands(smoothed, smoothing), [smoothed, smoothing])`.
4. `areas = buildBandAreas(profile, bands, plotScale)` — **raw** profile for the polygon top (accurate line), smoothed **bands** for colour.
5. `linePaths = buildLinePaths(profile, plotScale)` — **raw**.
6. `ticks = buildAxisTicks(profile, PLOT_HEIGHT, 3)`.
7. Remove all `bins` imports/usage; delete `bins.ts` + its test.
8. **Transparent background:** drop `backgroundColor: c.panelBackground` from the container.
9. **Y-axis:** reserve a left gutter (`GUTTER = 36`); the plot occupies `[GUTTER, width]`, so `plotWidth = width - GUTTER` and everything in the SVG plot is offset by `GUTTER` (render the plot inside an SVG `<G x={GUTTER}>` or add `GUTTER` to each x). Draw faint full-width gridlines at each tick's `y`, and an elevation label at the left gutter for each tick. Labels use an SVG halo (`stroke` = panel background colour, `strokeWidth` ~3, `fill` = text colour) so they read over the map.
10. **Line halo:** draw each line path twice — first a wider translucent dark stroke, then the coloured stroke — so the accurate line stays legible over the map.
11. **Scrub:** map touch x into plot coords with the gutter offset (`x = clamp(touchX - GUTTER, 0, plotWidth)`), `distance = (x/plotWidth)*totalDistance`; the cursor line is drawn at `x + GUTTER`. Tooltip elevation from `sampleAt(profile, distance).ele` (raw); tooltip **grade** from `sampleAt(smoothed, distance).grade` (matches the colour under the finger). Keep the rounded-grade "-0%"-safe formatting. On release clear cursor + scrub point (unchanged momentary-scrubber contract).

> Device-verified. `npx tsc --noEmit` is the gate. Keep the gesture `useMemo` + `.runOnJS(true)` discipline. **Device-verify checkpoints:** (a) barcode is gone — coherent colour blocks on a gentle hike; (b) descents are green, no stray orange; (c) background is see-through, line + labels legible over the map; (d) Y-axis elevations always visible; (e) changing the Settings smoothing window visibly changes the colouring; (f) flat sections show the map through to the baseline (no fill).

- [ ] **Step 1: Rework the component**

Apply changes 1–11 above. Reference `src/map/MapControls.tsx` for the gesture/animated-bottom idiom, and the existing `ElevationGraph.tsx` for the parts that stay (float positioning, `onLayout` width, `Svg`/`Path`/`Line` usage). The band-colour helper (`GradeBand → c.slopeSteep/Rough/Uphill/Downhill`) stays. Import `Line`, `Path`, `G`, and `Text` from `react-native-svg` as needed (add `G`/`Text`/`Rect` only if used).

- [ ] **Step 2: Delete the dead bins module**

```bash
git rm src/elevation/bins.ts src/elevation/__tests__/bins.test.ts
```

Confirm nothing else imports it:

Run: `grep -rn "elevation/bins\|from './bins'\|from '../bins'" src` → expect no output.

- [ ] **Step 3: Typecheck + full suite**

Run: `npx tsc --noEmit && npx jest`
Expected: clean; all suites pass (the elevation suite now has profile/slope/svg/scrubStore + preferences; bins suite is gone).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(elevation): smoothed slope colouring, transparent graph, Y-axis; remove pixel bins"
```

---

### Task 7: Settings-tab smoothing control

**Files:**
- Modify: `app/(tabs)/settings.tsx`

**Interfaces:**
- Consumes: `usePreferencesStore` (`elevationSmoothingMeters`, `setElevationSmoothing`, `ELEVATION_SMOOTHING_PRESETS`), `useTheme`.
- Produces: no new exports — a new section on the Settings screen.

**Behaviour:** Below the existing "Offline maps" row, add an "Elevation smoothing" section: a label plus a row of selectable preset chips from `ELEVATION_SMOOTHING_PRESETS`. Each chip shows `Off` for `0`, else `${m} m`. The selected chip (matching `elevationSmoothingMeters`) is highlighted with `c.controlAccent`; tapping one calls `setElevationSmoothing`. Match the existing screen's styling idiom (theme colours, `borderColor: c.panelDivider`, rounded corners).

> Device-verified (UI). `npx tsc --noEmit` is the gate. **Device-verify checkpoints:** the current window is highlighted; tapping a chip persists (survives app restart) and the graph re-colours to match.

- [ ] **Step 1: Add the control**

Add a labelled section with a horizontal row of `Pressable` chips mapping over `ELEVATION_SMOOTHING_PRESETS`, wired to the store as described. Example chip content: `<Text>{m === 0 ? 'Off' : `${m} m`}</Text>`; highlight when `m === elevationSmoothingMeters`. Keep it accessible (`accessibilityLabel`, `accessibilityState={{ selected }}`).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add app/(tabs)/settings.tsx
git commit -m "feat(settings): elevation smoothing window control"
```

---

### Task 8: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Typecheck** — `npx tsc --noEmit` → clean.
- [ ] **Step 2: Full suite** — `npx jest` → all green (slope + preferences suites added; bins suite removed).
- [ ] **Step 3: Seam audit** — `grep -rn "@rnmapbox/maps" src --include=*.ts --include=*.tsx | grep -v "src/map/providers/mapbox/"` → no output.
- [ ] **Step 4: Dead-module check** — `grep -rn "elevation/bins" src` → no output.
- [ ] **Step 5: Device-verify checklist:**
  - [ ] Gentle hike shows coherent colour blocks, not a barcode.
  - [ ] Descents are green; no stray orange from small bumps.
  - [ ] Little to no black except on genuinely steep sustained runs.
  - [ ] Graph background is see-through; line and axis labels stay legible over the map.
  - [ ] Y-axis elevation values always visible; flat sections show the map through to the baseline.
  - [ ] Settings smoothing chips: current one highlighted; changing it re-colours the graph and persists across restart.
  - [ ] Scrub still drops a synced marker; tooltip elevation is accurate, grade matches the colour under the finger; both vanish on release.

---

## Self-Review

**Spec coverage (Revision 2026-09-02):**
- Smoothed colour pipeline replacing bins → Tasks 1 (`smoothProfile`), 2 (`slopeBands`), 5 (retarget `buildBandAreas`), 6 (wire + delete bins). ✓
- No MAX, no pixel bins; bands are distance-space runs → Task 2. ✓
- Colour under the accurate line; tooltip elevation raw, grade smoothed → Task 6. ✓
- Flat = no fill (transparent) → Task 6 (buildBandAreas already skips flat; container transparent). ✓
- Transparent background + halo legibility → Task 6. ✓
- Y-axis → Tasks 3 (`buildAxisTicks`) + 6 (render). ✓
- Smoothing default 50 m, per-segment, Off at 0 → Task 1. ✓
- Configurable in Settings → Tasks 4 (store) + 7 (UI). ✓
- Metrics tiles unchanged → untouched (no task). ✓

**Placeholder scan:** none — pure tasks carry full code; device tasks carry concrete change lists + key code.

**Type consistency:** `smoothProfile`/`slopeBands` operate on `ElevationProfile`; `SlopeBand` (`{start,end,band}`) is defined once in `slope.ts` and consumed by `buildBandAreas` (Task 5) and `ElevationGraph`/tests. `buildAxisTicks`/`AxisTick` defined in `svg.ts` and consumed in Task 6. `elevationSmoothingMeters`/`setElevationSmoothing`/`ELEVATION_SMOOTHING_PRESETS` defined in Task 4 and consumed in Tasks 6–7. `gradeBand` reused from `profile.ts` (not moved).
