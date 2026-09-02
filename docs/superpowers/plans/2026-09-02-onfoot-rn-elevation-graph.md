# Elevation Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A floating, scrubable elevation-profile strip above the info sheet — for trails, activities, and while recording — with the area under the curve coloured by slope and a synced map marker while scrubbing.

**Architecture:** A pure core (`src/elevation/`) turns `{lat,lng,ele}[][]` geometry into an `ElevationProfile`, colour bins, and SVG path strings — all TDD'd. A thin `<ElevationGraph>` (react-native-svg + a pan gesture) renders those and drives a `useScrubStore`. The map marker is drawn only through the provider seam: a new `ScrubMarker` on the port, implemented in the Mapbox adapter, rendered by a tiny `<ScrubMarkerLayer>` that subscribes to the scrub store so scrub updates don't re-render the whole map. `MapScreen` builds the profile for the active source and floats the graph above the sheet using the existing `controlsAnimatedBottom` mechanism.

**Tech Stack:** TypeScript (strict), react-native-svg 15, react-native-gesture-handler 2.32, react-native-reanimated 4.5, Zustand, Jest (jest-expo). No new dependencies.

## Global Constraints

- **Expo v57** — read `https://docs.expo.dev/versions/v57.0.0/` before touching native/config; none expected here.
- **Map-provider seam is inviolable** — only `src/map/providers/mapbox/` may import `@rnmapbox/maps`. The scrub marker is declared on the port (`src/map/provider/types.ts`) and rendered only in the adapter. Shared code stays provider-agnostic.
- **Pure logic is TDD'd first; native rendering/gestures are device-verified** (`src/**/__tests__/`).
- **No new dependencies** — svg, gesture-handler, reanimated are already installed.
- **Comments are minimal** — self-documenting code; describe current state, not changes.
- **React Compiler is ON** — don't hand-add `useMemo` to pure render derivations, BUT gesture objects (`Gesture.Pan()`) MUST be wrapped in `useMemo` with `.runOnJS(true)` (RNGH requirement; see `MapControls.tsx`), and deps that change every drag-frame must be read imperatively via `getState()`, not closed over.
- **Slope bands** (grade = rise ÷ run, %): `>25` steep, `>12..25` rough, `>4..12` uphill, `-4..4` flat (no fill), `<-4` downhill.

---

### Task 1: Elevation profile core

**Files:**
- Create: `src/elevation/profile.ts`
- Test: `src/elevation/__tests__/profile.test.ts`

**Interfaces:**
- Consumes: `haversineMeters` from `src/data/trails/gpx/metrics.ts`.
- Produces:
  ```ts
  export interface ElePoint { lat: number; lng: number; ele: number | null }
  export interface ElevationSample { distance: number; ele: number; lat: number; lng: number; segment: number }
  export interface ElevationProfile { samples: ElevationSample[]; minEle: number; maxEle: number; totalDistance: number }
  export function buildElevationProfile(segments: ElePoint[][]): ElevationProfile | null
  ```
  `GpxPoint` and `TrackPoint` are structurally assignable to `ElePoint`, so callers pass `trail.geometry.segments` / `activity.geometry.segments` directly. Distance is cumulative across the whole track but the inter-segment gap is excluded (a new segment's first point adds no distance), so a break appears as two samples sharing an x. Points with `ele === null` advance distance but emit no sample; `null` is returned when no point has elevation.

- [ ] **Step 1: Write the failing tests**

```ts
// src/elevation/__tests__/profile.test.ts
import { buildElevationProfile, ElePoint } from '../profile'

const seg = (lngs: number[], eles: (number | null)[]): ElePoint[] =>
  lngs.map((lng, i) => ({ lat: 0, lng, ele: eles[i] }))

describe('buildElevationProfile', () => {
  it('returns null when no point has elevation', () => {
    expect(buildElevationProfile([seg([0, 0.001], [null, null])])).toBeNull()
  })

  it('accumulates cumulative distance and keeps elevation per sample', () => {
    const p = buildElevationProfile([seg([0, 0.001, 0.002], [100, 110, 105])])!
    expect(p.samples).toHaveLength(3)
    expect(p.samples[0].distance).toBe(0)
    expect(p.samples[1].distance).toBeGreaterThan(0)
    expect(p.samples[2].distance).toBeGreaterThan(p.samples[1].distance)
    expect(p.minEle).toBe(100)
    expect(p.maxEle).toBe(110)
    expect(p.totalDistance).toBe(p.samples[2].distance)
  })

  it('excludes the inter-segment gap: segment 2 starts at the same distance segment 1 ended', () => {
    const a = seg([0, 0.001], [100, 110])
    const b = seg([1, 1.001], [200, 190]) // far away
    const p = buildElevationProfile([a, b])!
    const endOfA = p.samples[1].distance
    const startOfB = p.samples[2].distance
    expect(startOfB).toBe(endOfA) // gap carries no distance
    expect(p.samples[2].segment).toBe(1)
  })

  it('skips null-elevation points but still advances distance through them', () => {
    const p = buildElevationProfile([seg([0, 0.001, 0.002], [100, null, 120])])!
    expect(p.samples.map((s) => s.ele)).toEqual([100, 120])
    expect(p.samples[1].distance).toBeGreaterThan(p.samples[0].distance) // distance crossed the skipped point
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/elevation/__tests__/profile.test.ts`
Expected: FAIL — `Cannot find module '../profile'`.

- [ ] **Step 3: Implement**

```ts
// src/elevation/profile.ts
import { haversineMeters } from '../data/trails/gpx/metrics'

export interface ElePoint { lat: number; lng: number; ele: number | null }
export interface ElevationSample { distance: number; ele: number; lat: number; lng: number; segment: number }
export interface ElevationProfile { samples: ElevationSample[]; minEle: number; maxEle: number; totalDistance: number }

export function buildElevationProfile(segments: ElePoint[][]): ElevationProfile | null {
  const samples: ElevationSample[] = []
  let cumulative = 0
  let minEle = Infinity
  let maxEle = -Infinity
  segments.forEach((segment, segmentIndex) => {
    for (let i = 0; i < segment.length; i++) {
      const point = segment[i]
      if (i > 0) {
        const prev = segment[i - 1]
        cumulative += haversineMeters(prev.lat, prev.lng, point.lat, point.lng)
      }
      if (point.ele === null) continue
      samples.push({ distance: cumulative, ele: point.ele, lat: point.lat, lng: point.lng, segment: segmentIndex })
      if (point.ele < minEle) minEle = point.ele
      if (point.ele > maxEle) maxEle = point.ele
    }
  })
  if (samples.length === 0) return null
  return { samples, minEle, maxEle, totalDistance: samples[samples.length - 1].distance }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest src/elevation/__tests__/profile.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/elevation/profile.ts src/elevation/__tests__/profile.test.ts
git commit -m "feat(elevation): build elevation profile from segmented geometry"
```

---

### Task 2: Grade bands

**Files:**
- Modify: `src/elevation/profile.ts` (append)
- Test: `src/elevation/__tests__/profile.test.ts` (append a `describe`)

**Interfaces:**
- Produces:
  ```ts
  export type GradeBand = 'steep' | 'rough' | 'uphill' | 'flat' | 'downhill'
  export function gradeBand(gradePercent: number): GradeBand
  ```

- [ ] **Step 1: Write the failing tests** (append to `profile.test.ts`)

```ts
import { gradeBand } from '../profile'

describe('gradeBand', () => {
  it('maps grade percentages to bands at the documented boundaries', () => {
    expect(gradeBand(30)).toBe('steep')
    expect(gradeBand(25)).toBe('rough')   // 25 is NOT steep (> 25 only)
    expect(gradeBand(20)).toBe('rough')
    expect(gradeBand(12)).toBe('uphill')  // 12 is NOT rough
    expect(gradeBand(8)).toBe('uphill')
    expect(gradeBand(4)).toBe('flat')     // 4 is NOT uphill
    expect(gradeBand(0)).toBe('flat')
    expect(gradeBand(-4)).toBe('flat')    // -4 is still flat
    expect(gradeBand(-5)).toBe('downhill')
    expect(gradeBand(-30)).toBe('downhill')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/elevation/__tests__/profile.test.ts -t gradeBand`
Expected: FAIL — `gradeBand is not a function`.

- [ ] **Step 3: Implement** (append to `profile.ts`)

```ts
export type GradeBand = 'steep' | 'rough' | 'uphill' | 'flat' | 'downhill'

export function gradeBand(gradePercent: number): GradeBand {
  if (gradePercent > 25) return 'steep'
  if (gradePercent > 12) return 'rough'
  if (gradePercent > 4) return 'uphill'
  if (gradePercent >= -4) return 'flat'
  return 'downhill'
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest src/elevation/__tests__/profile.test.ts -t gradeBand`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/elevation/profile.ts src/elevation/__tests__/profile.test.ts
git commit -m "feat(elevation): map grade percentage to slope bands"
```

---

### Task 3: Scrub sampling (`sampleAt`)

**Files:**
- Modify: `src/elevation/profile.ts` (append)
- Test: `src/elevation/__tests__/profile.test.ts` (append)

**Interfaces:**
- Consumes: `ElevationProfile` (Task 1).
- Produces:
  ```ts
  export interface ScrubSample { ele: number; grade: number; lat: number; lng: number }
  export function sampleAt(profile: ElevationProfile, distance: number): ScrubSample
  ```
  Interpolates ele/lat/lng at a distance (clamped to `[0, totalDistance]`); `grade` is the bracketing pair's grade (%). Across a gap pair (`a.segment !== b.segment`) or a zero-length span, returns the right sample with `grade: 0`.

- [ ] **Step 1: Write the failing tests** (append)

```ts
import { buildElevationProfile as build, sampleAt } from '../profile'

describe('sampleAt', () => {
  // Single segment, 0 → ~111.19 m across, ele 100 → 200 (so grade is a clean function of distance).
  const p = build([[
    { lat: 0, lng: 0, ele: 100 },
    { lat: 0, lng: 0.001, ele: 200 },
  ]])!

  it('clamps below zero to the first sample', () => {
    expect(sampleAt(p, -50)).toMatchObject({ ele: 100, lat: 0, lng: 0 })
  })
  it('clamps beyond the end to the last sample', () => {
    expect(sampleAt(p, p.totalDistance + 999).ele).toBe(200)
  })
  it('interpolates elevation and coordinates at the midpoint', () => {
    const mid = sampleAt(p, p.totalDistance / 2)
    expect(mid.ele).toBeCloseTo(150, 5)
    expect(mid.lng).toBeCloseTo(0.0005, 6)
    expect(mid.grade).toBeGreaterThan(0)
  })
  it('reports grade 0 across an inter-segment gap', () => {
    const g = build([
      [{ lat: 0, lng: 0, ele: 100 }, { lat: 0, lng: 0.001, ele: 100 }],
      [{ lat: 0, lng: 1, ele: 400 }, { lat: 0, lng: 1.001, ele: 400 }],
    ])!
    const endOfA = g.samples[1].distance
    expect(sampleAt(g, endOfA).grade).toBe(0)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/elevation/__tests__/profile.test.ts -t sampleAt`
Expected: FAIL — `sampleAt is not a function`.

- [ ] **Step 3: Implement** (append)

```ts
export interface ScrubSample { ele: number; grade: number; lat: number; lng: number }

export function sampleAt(profile: ElevationProfile, distance: number): ScrubSample {
  const { samples } = profile
  const d = Math.max(0, Math.min(distance, profile.totalDistance))
  if (d <= samples[0].distance) {
    const s = samples[0]
    return { ele: s.ele, grade: 0, lat: s.lat, lng: s.lng }
  }
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1]
    const b = samples[i]
    if (d <= b.distance) {
      const span = b.distance - a.distance
      if (span === 0 || a.segment !== b.segment) {
        return { ele: b.ele, grade: 0, lat: b.lat, lng: b.lng }
      }
      const t = (d - a.distance) / span
      return {
        ele: a.ele + (b.ele - a.ele) * t,
        grade: ((b.ele - a.ele) / span) * 100,
        lat: a.lat + (b.lat - a.lat) * t,
        lng: a.lng + (b.lng - a.lng) * t,
      }
    }
  }
  const last = samples[samples.length - 1]
  return { ele: last.ele, grade: 0, lat: last.lat, lng: last.lng }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest src/elevation/__tests__/profile.test.ts -t sampleAt`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/elevation/profile.ts src/elevation/__tests__/profile.test.ts
git commit -m "feat(elevation): interpolate a scrub sample at a distance"
```

---

### Task 4: Colour bins (fixed-width, max-grade)

**Files:**
- Create: `src/elevation/bins.ts`
- Test: `src/elevation/__tests__/bins.test.ts`

**Interfaces:**
- Consumes: `ElevationProfile`, `GradeBand`, `gradeBand` (Tasks 1–2).
- Produces:
  ```ts
  export interface ColorBin { start: number; end: number; band: GradeBand }
  export function buildColorBins(profile: ElevationProfile, binMeters: number): ColorBin[]
  ```
  Bins the distance axis into fixed-width (`binMeters`) buckets; each bucket's band is `gradeBand(max grade among the same-segment sample-pairs overlapping it)`. Buckets with no overlapping pair (a gap) are omitted. Contiguous same-band buckets are coalesced. Colouring by **max** grade (not mean) keeps a short steep bit visible.

- [ ] **Step 1: Write the failing tests**

```ts
// src/elevation/__tests__/bins.test.ts
import { buildColorBins } from '../bins'
import { buildElevationProfile, ElePoint } from '../profile'

// A segment whose elevation climbs steeply then eases, over ~445 m (4 points, ~111 m spacing at lat 0).
const climb: ElePoint[] = [
  { lat: 0, lng: 0.000, ele: 100 },
  { lat: 0, lng: 0.001, ele: 145 }, // +45 m over ~111 m ≈ 40% → steep
  { lat: 0, lng: 0.002, ele: 150 }, // +5 m ≈ 4.5% → uphill
  { lat: 0, lng: 0.003, ele: 150 }, // flat
]

describe('buildColorBins', () => {
  it('returns [] for a zero-width or non-positive bin size', () => {
    const p = buildElevationProfile([climb])!
    expect(buildColorBins(p, 0)).toEqual([])
  })

  it('colours each bin by the steepest grade it covers', () => {
    const p = buildElevationProfile([climb])!
    // One bin per ~111 m span so each pair lands in its own bin.
    const bins = buildColorBins(p, p.totalDistance / 3)
    expect(bins[0].band).toBe('steep')
    expect(bins.some((b) => b.band === 'uphill')).toBe(true)
    expect(bins.some((b) => b.band === 'flat')).toBe(true)
    // Bins tile the whole axis with no gaps within a single segment.
    expect(bins[0].start).toBe(0)
    expect(bins[bins.length - 1].end).toBeCloseTo(p.totalDistance, 6)
  })

  it('coalesces contiguous same-band bins into one', () => {
    // Uniform 40% climb → every bin is steep → one coalesced bin.
    const steady = buildElevationProfile([[
      { lat: 0, lng: 0, ele: 0 },
      { lat: 0, lng: 0.001, ele: 44 },
      { lat: 0, lng: 0.002, ele: 88 },
    ]])!
    const bins = buildColorBins(steady, steady.totalDistance / 4)
    expect(bins).toHaveLength(1)
    expect(bins[0]).toMatchObject({ start: 0, band: 'steep' })
    expect(bins[0].end).toBeCloseTo(steady.totalDistance, 6)
  })

  it('omits bins that fall in an inter-segment gap', () => {
    const a: ElePoint[] = [{ lat: 0, lng: 0, ele: 0 }, { lat: 0, lng: 0.001, ele: 44 }]
    const b: ElePoint[] = [{ lat: 0, lng: 1, ele: 0 }, { lat: 0, lng: 1.001, ele: 44 }]
    const p = buildElevationProfile([a, b])!
    // Both segments occupy the same distance range (gap carries no distance), so their
    // pairs overlap the same bins — every covered bin is steep, none is empty.
    const bins = buildColorBins(p, p.totalDistance)
    expect(bins.every((x) => x.band === 'steep')).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/elevation/__tests__/bins.test.ts`
Expected: FAIL — `Cannot find module '../bins'`.

- [ ] **Step 3: Implement**

```ts
// src/elevation/bins.ts
import { ElevationProfile, GradeBand, gradeBand } from './profile'

export interface ColorBin { start: number; end: number; band: GradeBand }

export function buildColorBins(profile: ElevationProfile, binMeters: number): ColorBin[] {
  if (binMeters <= 0 || profile.totalDistance <= 0) return []
  const { samples } = profile

  const spans: { start: number; end: number; grade: number }[] = []
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1]
    const b = samples[i]
    if (a.segment !== b.segment) continue
    const span = b.distance - a.distance
    if (span <= 0) continue
    spans.push({ start: a.distance, end: b.distance, grade: ((b.ele - a.ele) / span) * 100 })
  }

  const binCount = Math.ceil(profile.totalDistance / binMeters)
  const bins: ColorBin[] = []
  for (let i = 0; i < binCount; i++) {
    const start = i * binMeters
    const end = Math.min((i + 1) * binMeters, profile.totalDistance)
    let maxGrade = -Infinity
    for (const s of spans) {
      if (s.start < end && s.end > start) maxGrade = Math.max(maxGrade, s.grade)
    }
    if (maxGrade === -Infinity) continue
    const band = gradeBand(maxGrade)
    const last = bins[bins.length - 1]
    if (last && last.band === band && last.end === start) last.end = end
    else bins.push({ start, end, band })
  }
  return bins
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest src/elevation/__tests__/bins.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/elevation/bins.ts src/elevation/__tests__/bins.test.ts
git commit -m "feat(elevation): fixed-width colour bins by steepest grade"
```

---

### Task 5: SVG geometry (line paths + band areas)

**Files:**
- Create: `src/elevation/svg.ts`
- Test: `src/elevation/__tests__/svg.test.ts`

**Interfaces:**
- Consumes: `ElevationProfile`, `sampleAt` (Tasks 1, 3); `ColorBin` (Task 4); `GradeBand` (Task 2).
- Produces:
  ```ts
  export interface PlotScale { width: number; height: number }
  export function projectX(distance: number, profile: ElevationProfile, width: number): number
  export function projectY(ele: number, profile: ElevationProfile, height: number): number
  export function buildLinePaths(profile: ElevationProfile, scale: PlotScale): string[]
  export interface BandArea { band: GradeBand; d: string }
  export function buildBandAreas(profile: ElevationProfile, bins: ColorBin[], scale: PlotScale): BandArea[]
  ```
  `projectY` inverts so higher elevation = smaller y; flat-elevation profiles (`maxEle === minEle`) centre at `height/2`. `buildLinePaths` starts a new path at every segment change (so gaps are not connected). `buildBandAreas` emits one filled polygon per non-`flat` bin (top edge follows the elevation line across the bin, bottom edge is the baseline `y = height`).

- [ ] **Step 1: Write the failing tests**

```ts
// src/elevation/__tests__/svg.test.ts
import { projectX, projectY, buildLinePaths, buildBandAreas } from '../svg'
import { buildElevationProfile, ElePoint } from '../profile'
import { buildColorBins } from '../bins'

const oneSeg = buildElevationProfile([[
  { lat: 0, lng: 0, ele: 0 },
  { lat: 0, lng: 0.001, ele: 100 },
]])!

describe('projection', () => {
  it('maps distance across the full width', () => {
    expect(projectX(0, oneSeg, 200)).toBe(0)
    expect(projectX(oneSeg.totalDistance, oneSeg, 200)).toBeCloseTo(200, 6)
  })
  it('inverts elevation: max at top (y=0), min at bottom (y=height)', () => {
    expect(projectY(100, oneSeg, 50)).toBeCloseTo(0, 6)
    expect(projectY(0, oneSeg, 50)).toBeCloseTo(50, 6)
  })
  it('centres a flat-elevation profile', () => {
    const flat = buildElevationProfile([[
      { lat: 0, lng: 0, ele: 42 }, { lat: 0, lng: 0.001, ele: 42 },
    ]])!
    expect(projectY(42, flat, 80)).toBe(40)
  })
})

describe('buildLinePaths', () => {
  it('produces a single move-to/line-to path for one segment', () => {
    const paths = buildLinePaths(oneSeg, { width: 200, height: 50 })
    expect(paths).toHaveLength(1)
    expect(paths[0].startsWith('M ')).toBe(true)
    expect(paths[0]).toContain(' L ')
  })
  it('breaks the line into one path per segment (no line across the gap)', () => {
    const twoSeg = buildElevationProfile([
      [{ lat: 0, lng: 0, ele: 0 }, { lat: 0, lng: 0.001, ele: 10 }],
      [{ lat: 0, lng: 1, ele: 50 }, { lat: 0, lng: 1.001, ele: 60 }],
    ])!
    expect(buildLinePaths(twoSeg, { width: 200, height: 50 })).toHaveLength(2)
  })
})

describe('buildBandAreas', () => {
  it('emits a closed filled polygon per non-flat bin', () => {
    const bins = buildColorBins(oneSeg, oneSeg.totalDistance) // one steep bin
    const areas = buildBandAreas(oneSeg, bins, { width: 200, height: 50 })
    expect(areas).toHaveLength(1)
    expect(areas[0].band).toBe('steep')
    expect(areas[0].d.startsWith('M ')).toBe(true)
    expect(areas[0].d.trim().endsWith('Z')).toBe(true)
  })
  it('skips flat bins (they render as empty)', () => {
    const flat = buildElevationProfile([[
      { lat: 0, lng: 0, ele: 10 }, { lat: 0, lng: 0.001, ele: 10 },
    ]])!
    const bins = buildColorBins(flat, flat.totalDistance)
    expect(buildBandAreas(flat, bins, { width: 200, height: 50 })).toEqual([])
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/elevation/__tests__/svg.test.ts`
Expected: FAIL — `Cannot find module '../svg'`.

- [ ] **Step 3: Implement**

```ts
// src/elevation/svg.ts
import { ElevationProfile, GradeBand, sampleAt } from './profile'
import { ColorBin } from './bins'

export interface PlotScale { width: number; height: number }

export function projectX(distance: number, profile: ElevationProfile, width: number): number {
  if (profile.totalDistance <= 0) return 0
  return (distance / profile.totalDistance) * width
}

export function projectY(ele: number, profile: ElevationProfile, height: number): number {
  const range = profile.maxEle - profile.minEle
  if (range <= 0) return height / 2
  return height - ((ele - profile.minEle) / range) * height
}

export function buildLinePaths(profile: ElevationProfile, scale: PlotScale): string[] {
  const paths: string[] = []
  let current = ''
  let currentSegment = -1
  for (const s of profile.samples) {
    const x = projectX(s.distance, profile, scale.width)
    const y = projectY(s.ele, profile, scale.height)
    if (s.segment !== currentSegment) {
      if (current) paths.push(current)
      current = `M ${x} ${y}`
      currentSegment = s.segment
    } else {
      current += ` L ${x} ${y}`
    }
  }
  if (current) paths.push(current)
  return paths
}

export interface BandArea { band: GradeBand; d: string }

export function buildBandAreas(profile: ElevationProfile, bins: ColorBin[], scale: PlotScale): BandArea[] {
  const baseline = scale.height
  const areas: BandArea[] = []
  for (const bin of bins) {
    if (bin.band === 'flat') continue
    const startEle = sampleAt(profile, bin.start).ele
    const endEle = sampleAt(profile, bin.end).ele
    const inner = profile.samples.filter((s) => s.distance > bin.start && s.distance < bin.end)
    const top: [number, number][] = [
      [projectX(bin.start, profile, scale.width), projectY(startEle, profile, scale.height)],
      ...inner.map((s): [number, number] => [
        projectX(s.distance, profile, scale.width),
        projectY(s.ele, profile, scale.height),
      ]),
      [projectX(bin.end, profile, scale.width), projectY(endEle, profile, scale.height)],
    ]
    const x0 = top[0][0]
    const x1 = top[top.length - 1][0]
    const d = `M ${x0} ${baseline} ` + top.map(([x, y]) => `L ${x} ${y}`).join(' ') + ` L ${x1} ${baseline} Z`
    areas.push({ band: bin.band, d })
  }
  return areas
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest src/elevation/__tests__/svg.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/elevation/svg.ts src/elevation/__tests__/svg.test.ts
git commit -m "feat(elevation): SVG line paths and per-band filled areas"
```

---

### Task 6: Slope colour tokens

**Files:**
- Modify: `src/theme/colors.ts` (add 4 keys to `AppColors`, `lightColors`, `darkColors`)

**Interfaces:**
- Produces: `slopeSteep`, `slopeRough`, `slopeUphill`, `slopeDownhill` on `AppColors`, readable via `useTheme()`.

> No unit test — colour values are device-verified. `npx tsc --noEmit` is the gate (adding a key to `AppColors` forces both palettes to define it). **Device-verify checkpoint:** black on the dark-theme graph surface (`#1E1E1E`) is low-contrast; confirm the steep band reads clearly and tune here if not.

- [ ] **Step 1: Add the interface keys**

In `src/theme/colors.ts`, add to the `AppColors` interface (after `danger`):

```ts
  slopeSteep: string
  slopeRough: string
  slopeUphill: string
  slopeDownhill: string
```

- [ ] **Step 2: Add the light-theme values**

In `lightColors` (after `danger`):

```ts
  slopeSteep: '#000000',
  slopeRough: '#D32F2F',
  slopeUphill: '#F57C00',
  slopeDownhill: '#43A047',
```

- [ ] **Step 3: Add the dark-theme values**

In `darkColors` (after `danger`):

```ts
  slopeSteep: '#000000',
  slopeRough: '#EF5350',
  slopeUphill: '#FFB74D',
  slopeDownhill: '#66BB6A',
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean (no "missing property" errors on the palettes).

- [ ] **Step 5: Commit**

```bash
git add src/theme/colors.ts
git commit -m "feat(theme): slope band colours for the elevation graph"
```

---

### Task 7: Scrub store

**Files:**
- Create: `src/elevation/scrubStore.ts`
- Test: `src/elevation/__tests__/scrubStore.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface ScrubPoint { lat: number; lng: number }
  export const useScrubStore // { point: ScrubPoint | null; setPoint: (p: ScrubPoint | null) => void }
  ```
  Holds the current scrub geographic point (or `null` when not scrubbing). Only `<ScrubMarkerLayer>` subscribes, so scrub updates re-render just the marker.

- [ ] **Step 1: Write the failing test**

```ts
// src/elevation/__tests__/scrubStore.test.ts
import { useScrubStore } from '../scrubStore'

beforeEach(() => useScrubStore.setState({ point: null }))

describe('scrubStore', () => {
  it('starts empty', () => {
    expect(useScrubStore.getState().point).toBeNull()
  })
  it('setPoint sets and clears the scrub point', () => {
    useScrubStore.getState().setPoint({ lat: 1, lng: 2 })
    expect(useScrubStore.getState().point).toEqual({ lat: 1, lng: 2 })
    useScrubStore.getState().setPoint(null)
    expect(useScrubStore.getState().point).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/elevation/__tests__/scrubStore.test.ts`
Expected: FAIL — `Cannot find module '../scrubStore'`.

- [ ] **Step 3: Implement**

```ts
// src/elevation/scrubStore.ts
import { create } from 'zustand'

export interface ScrubPoint { lat: number; lng: number }

interface ScrubStore {
  point: ScrubPoint | null
  setPoint: (point: ScrubPoint | null) => void
}

export const useScrubStore = create<ScrubStore>((set) => ({
  point: null,
  setPoint: (point) => set({ point }),
}))
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest src/elevation/__tests__/scrubStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/elevation/scrubStore.ts src/elevation/__tests__/scrubStore.test.ts
git commit -m "feat(elevation): scrub-point store for the map marker"
```

---

### Task 8: Scrub marker on the provider seam

**Files:**
- Modify: `src/map/provider/types.ts` (add `ScrubMarkerProps`, add `ScrubMarker` to `MapComponents`)
- Modify: `src/map/providers/mapbox/adapter.tsx` (implement `ScrubMarker`, register it)

**Interfaces:**
- Produces:
  ```ts
  export interface ScrubMarkerProps {
    coordinate: [number, number] // [lng, lat]
    color: string
    radius: number
    strokeColor: string
    strokeWidth: number
  }
  // MapComponents gains: ScrubMarker: React.ComponentType<ScrubMarkerProps>
  ```

> Seam task — no unit test; `npx tsc --noEmit` is the gate (adding `ScrubMarker` to `MapComponents` forces the adapter to provide it). Rendering is device-verified in Task 11.

- [ ] **Step 1: Declare the port type**

In `src/map/provider/types.ts`, add after `RouteLineProps`:

```ts
export interface ScrubMarkerProps {
  // [lng, lat] of the point being scrubbed on the elevation graph.
  coordinate: [number, number]
  color: string
  radius: number
  strokeColor: string
  strokeWidth: number
}
```

Then add to the `MapComponents` interface:

```ts
  ScrubMarker: React.ComponentType<ScrubMarkerProps>
```

- [ ] **Step 2: Run typecheck to see the adapter gap**

Run: `npx tsc --noEmit`
Expected: FAIL — `mapboxProvider.components` is missing `ScrubMarker`.

- [ ] **Step 3: Implement in the adapter**

In `src/map/providers/mapbox/adapter.tsx`, add `ScrubMarkerProps` to the type import from `../../provider/types`, then add the component after `RouteLine`:

```tsx
const ScrubMarker = ({ coordinate, color, radius, strokeColor, strokeWidth }: ScrubMarkerProps) => (
  <Mapbox.ShapeSource
    id="scrub-marker-source"
    shape={{ type: 'Feature', geometry: { type: 'Point', coordinates: coordinate }, properties: {} }}
  >
    <Mapbox.CircleLayer
      id="scrub-marker"
      style={{ circleColor: color, circleRadius: radius, circleStrokeColor: strokeColor, circleStrokeWidth: strokeWidth }}
    />
  </Mapbox.ShapeSource>
)
```

And register it:

```tsx
  components: { View, Camera, Terrain, UserPuck, TrailOverlay, RouteLine, ScrubMarker },
```

- [ ] **Step 4: Run typecheck to verify it passes**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/map/provider/types.ts src/map/providers/mapbox/adapter.tsx
git commit -m "feat(map): scrub marker on the provider seam"
```

---

### Task 9: Scrub marker layer + mount in the map

**Files:**
- Create: `src/map/ScrubMarkerLayer.tsx`
- Modify: `src/map/MapCanvas.tsx` (mount it inside `<MapView>`, after `<MapOverlays>`)

**Interfaces:**
- Consumes: `useScrubStore` (Task 7), `useMapProvider`, `useTheme`, `MapTokens`, `ScrubMarkerProps` seam (Task 8).
- Produces: `export function ScrubMarkerLayer(): JSX.Element | null`.

> Device-verified rendering; no unit test. `npx tsc --noEmit` is the gate.

- [ ] **Step 1: Create the layer**

```tsx
// src/map/ScrubMarkerLayer.tsx
import { useMapProvider } from './provider'
import { useTheme } from '../theme/useTheme'
import { MapTokens } from '../theme/tokens'
import { useScrubStore } from '../elevation/scrubStore'

export function ScrubMarkerLayer() {
  const point = useScrubStore((s) => s.point)
  const { components } = useMapProvider()
  const c = useTheme()
  if (!point) return null
  const { ScrubMarker } = components
  return (
    <ScrubMarker
      coordinate={[point.lng, point.lat]}
      color={c.controlAccent}
      radius={MapTokens.endpointRadius}
      strokeColor={c.trailEndpointStroke}
      strokeWidth={MapTokens.endpointStrokeWidth}
    />
  )
}
```

- [ ] **Step 2: Mount it in MapCanvas**

In `src/map/MapCanvas.tsx`, import it:

```tsx
import { ScrubMarkerLayer } from './ScrubMarkerLayer'
```

and render it immediately after `<MapOverlays .../>` (so the marker paints above the track):

```tsx
        <MapOverlays route={route} liveSegments={liveSegments} showLiveTrack={showLiveTrack} />
        <ScrubMarkerLayer />
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/map/ScrubMarkerLayer.tsx src/map/MapCanvas.tsx
git commit -m "feat(map): render the scrub marker layer above the track"
```

---

### Task 10: ElevationGraph component

**Files:**
- Create: `src/elevation/ElevationGraph.tsx`

**Interfaces:**
- Consumes: `ElevationProfile`, `sampleAt` (Tasks 1, 3); `buildColorBins` (4); `buildLinePaths`, `buildBandAreas`, `projectX` (5); slope tokens (6); `useScrubStore` (7).
- Produces:
  ```ts
  export const GRAPH_HEIGHT: number // total strip height incl. labels — MapScreen offsets controls by this
  export function ElevationGraph(props: {
    profile: ElevationProfile
    animatedBottom?: import('react-native-reanimated').SharedValue<number>
  }): JSX.Element
  ```
  Renders the coloured band areas + elevation line in an SVG, floats above the sheet (mirrors `MapControls`' `animatedBottom` pattern), and on pan updates a local cursor + the scrub store. On release it clears both.

> Device-verified. No unit test (SVG + gesture). The pure pieces it composes are already tested in Tasks 1–5.

**Implementation notes (carry the RNGH lessons from `MapControls.tsx`):**
- Wrap the `Gesture.Pan()` in `useMemo` with `.runOnJS(true)`. Its only dep is the stable `width` + `profile`; read nothing that changes every frame by closure — the handler recomputes from `e.x` each update.
- The pan handler sets local React state (cursor x + tooltip text) and `useScrubStore.getState().setPoint(...)`. `onFinalize` clears both (`setCursor(null)`, `setPoint(null)`).
- Plot width comes from `onLayout`; render the SVG only once `width > 0`.
- `binMeters = profile.totalDistance / Math.max(1, Math.round(width / 3))` → ~3px bins.

- [ ] **Step 1: Implement the component**

```tsx
// src/elevation/ElevationGraph.tsx
import { useMemo, useState } from 'react'
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native'
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Svg, { Line, Path } from 'react-native-svg'
import { useTheme } from '../theme/useTheme'
import { MapTokens } from '../theme/tokens'
import { formatDistance, formatElevation } from '../data/trails/gpx/metrics'
import { ElevationProfile, GradeBand, sampleAt } from './profile'
import { buildColorBins } from './bins'
import { buildBandAreas, buildLinePaths, projectX } from './svg'
import { useScrubStore } from './scrubStore'

const PLOT_HEIGHT = 96
const LABEL_ROW = 18
export const GRAPH_HEIGHT = PLOT_HEIGHT + LABEL_ROW

interface Cursor { x: number; label: string }

export function ElevationGraph({
  profile,
  animatedBottom,
}: {
  profile: ElevationProfile
  animatedBottom?: SharedValue<number>
}) {
  const c = useTheme()
  const insets = useSafeAreaInsets()
  const setPoint = useScrubStore((s) => s.setPoint)
  const [width, setWidth] = useState(0)
  const [cursor, setCursor] = useState<Cursor | null>(null)

  const scale = { width, height: PLOT_HEIGHT }
  const areas = useMemo(() => {
    if (width === 0) return []
    const binMeters = profile.totalDistance / Math.max(1, Math.round(width / 3))
    return buildBandAreas(profile, buildColorBins(profile, binMeters), scale)
  }, [profile, width])
  const linePaths = useMemo(() => (width === 0 ? [] : buildLinePaths(profile, scale)), [profile, width])

  const bandColor = (band: GradeBand): string =>
    band === 'steep' ? c.slopeSteep
    : band === 'rough' ? c.slopeRough
    : band === 'uphill' ? c.slopeUphill
    : c.slopeDownhill

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .onBegin((e) => scrubTo(e.x))
        .onUpdate((e) => scrubTo(e.x))
        .onFinalize(() => {
          setCursor(null)
          setPoint(null)
        })
        .runOnJS(true),
    [width, profile],
  )

  function scrubTo(px: number) {
    if (width === 0) return
    const x = Math.max(0, Math.min(px, width))
    const distance = (x / width) * profile.totalDistance
    const s = sampleAt(profile, distance)
    setCursor({
      x,
      label: `${formatElevation(s.ele)} · ${formatDistance(distance)} · ${s.grade >= 0 ? '+' : ''}${s.grade.toFixed(0)}%`,
    })
    setPoint({ lat: s.lat, lng: s.lng })
  }

  const containerStyle = useAnimatedStyle(() => ({
    bottom: animatedBottom ? animatedBottom.value : insets.bottom + MapTokens.overlayPadding,
  }))

  return (
    <Animated.View style={[styles.container, { backgroundColor: c.panelBackground }, containerStyle]}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: c.onSurfaceVariant }]}>
          {cursor ? cursor.label : `${formatElevation(profile.minEle)}–${formatElevation(profile.maxEle)}`}
        </Text>
      </View>
      <GestureDetector gesture={pan}>
        <View style={styles.plot} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
          {width > 0 && (
            <Svg width={width} height={PLOT_HEIGHT}>
              {areas.map((a, i) => (
                <Path key={i} d={a.d} fill={bandColor(a.band)} />
              ))}
              {linePaths.map((d, i) => (
                <Path key={i} d={d} stroke={c.onSurface} strokeWidth={2} fill="none" />
              ))}
              {cursor && (
                <Line x1={cursor.x} y1={0} x2={cursor.x} y2={PLOT_HEIGHT} stroke={c.controlAccent} strokeWidth={1.5} />
              )}
            </Svg>
          )}
        </View>
      </GestureDetector>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: MapTokens.overlayPadding,
    right: MapTokens.overlayPadding,
    height: GRAPH_HEIGHT,
    borderRadius: 12,
    overflow: 'hidden',
    paddingHorizontal: 8,
  },
  labelRow: { height: LABEL_ROW, justifyContent: 'center' },
  label: { fontSize: 12, fontWeight: '600' },
  plot: { height: PLOT_HEIGHT },
})
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/elevation/ElevationGraph.tsx
git commit -m "feat(elevation): scrubable elevation graph component"
```

---

### Task 11: Wire the graph into MapScreen (all four cases)

**Files:**
- Modify: `src/map/MapScreen.tsx`

**Interfaces:**
- Consumes: `buildElevationProfile` (Task 1), `ElevationGraph` + `GRAPH_HEIGHT` (Task 10), `groupPointsBySegment` (`src/data/activities/mapping`), `useRecordingStore` livePoints.
- Produces: no new exports — composition only.

**Behaviour:** Build `activeProfile` for the current mode's source:
- `mode === 'trail'` → `trail.geometry.segments`
- `mode === 'activity'` → `activity.geometry.segments`
- `mode === 'recording'` → followed `trail.geometry.segments` if `trail`, else `groupPointsBySegment(livePoints)`
Render `<ElevationGraph profile={activeProfile} animatedBottom={controlsAnimatedBottom} />` only when `activeProfile != null`. When shown, raise the controls above the graph via a second derived value so they don't overlap the strip.

> Device-verified. `npx tsc --noEmit` is the gate. **Device-verify checkpoints:** (a) graph hugs the sheet and rides it as it snaps/drags; (b) controls sit above the graph, not over it; (c) scrubbing drops a synced marker on the map; (d) no graph when the source lacks elevation; (e) while recording a followed trail, the graph is the trail's, not the live track's.

- [ ] **Step 1: Add imports**

```tsx
import { useMemo } from 'react'
import { buildElevationProfile } from '../elevation/profile'
import { ElevationGraph, GRAPH_HEIGHT } from '../elevation/ElevationGraph'
import { groupPointsBySegment } from '../data/activities/mapping'
import { MapTokens } from '../theme/tokens' // already imported — keep one
```

(`useDerivedValue` is already imported from `react-native-reanimated`; keep it.)

- [ ] **Step 2: Compute the active profile and the controls offset**

Inside `MapScreen`, after `controlsAnimatedBottom` is defined, add the recording live points and the profile source:

```tsx
  const livePoints = useRecordingStore((s) => s.livePoints)

  const activeProfile = useMemo(() => {
    const segments =
      mode === 'trail' ? trail?.geometry.segments
      : mode === 'activity' ? activity?.geometry.segments
      : mode === 'recording' ? (trail ? trail.geometry.segments : groupPointsBySegment(livePoints))
      : undefined
    return segments ? buildElevationProfile(segments) : null
  }, [mode, trail, activity, livePoints])

  // When the graph is shown it hugs the sheet top; lift the controls above it so they don't overlap.
  const controlsBottom = useDerivedValue(() =>
    activeProfile ? controlsAnimatedBottom.value + GRAPH_HEIGHT + MapTokens.controlsSpacing : controlsAnimatedBottom.value,
  )
```

- [ ] **Step 3: Point the controls at the offset value and render the graph**

Change the `MapControls` `animatedBottom` from `controlsAnimatedBottom` to `controlsBottom`:

```tsx
        <MapControls
          onOpenLayers={() => sheetRef.current?.present()}
          animatedBottom={mode !== 'free' ? controlsBottom : undefined}
        />
```

Then, just before the closing `</View>` of the root (after the `mode === 'recording'` block), add:

```tsx
        {activeProfile && (
          <ElevationGraph profile={activeProfile} animatedBottom={controlsAnimatedBottom} />
        )}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Run the full suite**

Run: `npx jest`
Expected: all pass (no regressions; new pure suites green).

- [ ] **Step 6: Commit**

```bash
git add src/map/MapScreen.tsx
git commit -m "feat(map): float the elevation graph above the sheet for trails, activities, recording"
```

---

### Task 12: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 2: Full test suite**

Run: `npx jest`
Expected: all green, including the 4 new elevation suites (profile, bins, svg, scrubStore).

- [ ] **Step 3: Seam audit**

Run: `grep -rn "@rnmapbox/maps" src --include=*.ts --include=*.tsx | grep -v "src/map/providers/mapbox/"`
Expected: no output (only the Mapbox adapter dir imports the SDK).

- [ ] **Step 4: Device-verify checklist** (physical device / emulator)

- [ ] Select a trail with elevation → graph appears above the sheet, coloured under the curve; scrub drops a synced marker on the map; lifting the finger clears cursor + marker.
- [ ] Select a trail/activity with no elevation → no graph, no empty box.
- [ ] Select an activity with a pause (multi-segment) → the profile shows a break (no line/fill across the gap).
- [ ] Graph hugs the sheet as it snaps between the two heights; controls stay above the graph.
- [ ] Record while following a trail → the followed trail's profile shows.
- [ ] Record with no trail → the live activity's profile builds as you move (once ≥2 points have elevation).
- [ ] Dark theme: all four slope bands are distinguishable (tune `slopeSteep` in `colors.ts` if black is too subtle on the dark surface).

---

## Self-Review

**Spec coverage:**
- Floating graph above the info sheet → Tasks 10 (float) + 11 (wiring). ✓
- Scrub to add/move a marker along the trail → Task 10 (pan) + Tasks 7–9 (scrub store → seam → marker). ✓
- Momentary scrubber (vanish on release) → Task 10 `onFinalize`. ✓
- Area coloured by slope, five bands, flat = no fill → Tasks 2 (bands), 4 (bins), 5 (band areas), 6 (colours), 10 (fill). ✓
- Fixed-width bins coloured by max grade; line stays on true samples → Task 4 (max grade) + Task 5 (line from raw samples). ✓
- Segment breaks as gaps → Tasks 1 (segment tag, gap distance), 4 (skip gap bins), 5 (per-segment line paths). ✓
- Appears for trails, activities, and recording (followed trail else live) → Task 11. ✓
- No elevation data → no graph → Tasks 1 (`null`) + 11 (conditional render). ✓
- Provider seam intact → Task 8 (port) + Task 12 Step 3 (audit). ✓
- Live position indicator → correctly OUT of scope (spec Future Work); no task. ✓

**Placeholder scan:** none — every code step is complete.

**Type consistency:** `ElevationProfile`/`ElevationSample`/`GradeBand`/`ColorBin`/`ScrubSample`/`PlotScale`/`BandArea`/`ScrubPoint`/`ScrubMarkerProps` are defined once and consumed with matching signatures across tasks. `buildColorBins(profile, binMeters)`, `buildBandAreas(profile, bins, scale)`, `sampleAt(profile, distance)`, `useScrubStore.setPoint(point)` are used identically where referenced.
