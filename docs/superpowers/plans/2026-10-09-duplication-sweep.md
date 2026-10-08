# Duplication Sweep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close DUP-1, DUP-7, DUP-11 and DUP-5 — four findings where one idea has two implementations.

**Architecture:** Each task collapses a duplicate onto the instance that already exists: the shared bounds helper in `map/geo.ts`, the pack-id module in `map/offline/packId.ts`, the `formatActivitySummary` naming convention, and the `controlContent` theme token.

**Tech Stack:** TypeScript 6, Jest 29 via jest-expo, React Native 0.86.

**Spec:** `docs/superpowers/specs/2026-10-09-duplication-sweep-design.md`

## Global Constraints

- **Every task is behaviour-preserving.** No task changes what the app computes. Three change what it *renders* — and only DUP-5 (one label, light theme, one shade) and DUP-11 (one separator glyph) do, both deliberately. If you find yourself changing a computed value, stop and report.
- **No device is available.** Nothing in this plan may depend on a device check. If a task turns out to need one, report it rather than guessing.
- NO JSDoc. Comments explain *why*, never what changed. Do not add a comment that narrates the refactor.
- Commit subjects: lowercase, conventional-commit prefix, ONE line, no body.
- Baseline, measured: **70 suites / 577 tests**. Each task states its own expected delta; derive the real number by running, never by assuming.
- Existing tests must pass **unchanged** except where a test names a renamed symbol or a moved type. If a test needs its *assertions* changed, that means behaviour changed — stop and report.

---

### Task 1: DUP-1 — one bounding box, one bounds type

**Files:**
- Modify: `src/map/geo.ts`, `src/map/offline/bounds.ts`, `src/map/offline/types.ts`, `src/map/offline/descriptor.ts`, `src/map/offline/estimate.ts`
- Test: `src/map/offline/__tests__/bounds.test.ts`

**Interfaces:**
- Produces: `LngLatBounds` now exported from `src/map/geo.ts` (removed from `src/map/offline/types.ts`); `boundsForPoints(points: { lat: number; lng: number }[]): LngLatBounds | null`. Later tasks do not consume these.

- [ ] **Step 1: Write the failing test**

Add to `src/map/offline/__tests__/bounds.test.ts` (keep every existing test as-is). Read the file first and match its import style and fixture naming.

```ts
test('a zero margin is exactly the raw point bounds', () => {
  const points = [
    { lat: 42.8, lng: 0.1 },
    { lat: 42.9, lng: 0.3 },
    { lat: 42.7, lng: 0.2 },
  ]
  expect(boundsForTrail(points, 0)).toEqual(boundsForPoints(points))
})
```

Import `boundsForPoints` from `../../geo`. This is the one genuinely new claim — that `boundsForTrail` is `boundsForPoints` plus a margin — and nothing pins it today.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/map/offline/__tests__/bounds.test.ts`
Expected: FAIL — `boundsForPoints` is not exported from `../../geo` with a compatible parameter type yet (it currently takes `GpxPoint[]`, and these fixtures have no `ele`).

- [ ] **Step 3: Move the type and widen the parameter**

In `src/map/geo.ts`, add the type above `toLineCoordinates` and change `boundsForPoints`'s signature. The function **body stays exactly as it is** — do not reorder or rewrite the min/max loop.

```ts
export type LngLatBounds = { ne: [number, number]; sw: [number, number] }
```

```ts
export function boundsForPoints(
  points: { lat: number; lng: number }[],
): LngLatBounds | null {
```

In `src/map/offline/types.ts`, delete the `LngLatBounds` line entirely. In `descriptor.ts` and `estimate.ts`, import it from `../geo` instead of `./types`, keeping their other imports from `./types` intact.

- [ ] **Step 4: Rewrite `bounds.ts` in terms of `boundsForPoints`**

Replace the whole of `src/map/offline/bounds.ts`:

```ts
import { boundsForPoints, LngLatBounds } from '../geo'

const KM_PER_LAT_DEGREE = 111

const expand = (bounds: LngLatBounds, marginKm: number): LngLatBounds => {
  const [maxLng, maxLat] = bounds.ne
  const [minLng, minLat] = bounds.sw
  const latMargin = marginKm / KM_PER_LAT_DEGREE
  const midLat = (minLat + maxLat) / 2
  const lngMargin = marginKm / (KM_PER_LAT_DEGREE * Math.max(0.01, Math.cos((midLat * Math.PI) / 180)))
  return {
    ne: [maxLng + lngMargin, maxLat + latMargin],
    sw: [minLng - lngMargin, minLat - latMargin],
  }
}

export function boundsForTrail(
  points: { lat: number; lng: number }[],
  marginKm: number,
): LngLatBounds | null {
  const bounds = boundsForPoints(points)
  return bounds && expand(bounds, marginKm)
}
```

`expand` is not exported — it is the only margin logic in the app and a second caller would re-derive the convention.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest src/map`
Expected: PASS, including every pre-existing bounds and geo test unchanged.

- [ ] **Step 6: Verify and commit**

Run: `npm run verify` — expected green at **70 suites / 578 tests**.

```bash
git add src/map
git commit -m "refactor(map): derive the trail bounds from the shared point bounds"
```

---

### Task 2: DUP-7 — parse the pack id once

**Files:**
- Modify: `src/map/offline/packId.ts`, `src/map/offline/badge.ts`, `src/map/offline/operations.ts`, `src/map/offline/OfflineLayerChooser.tsx`
- Test: `src/map/offline/__tests__/packId.test.ts`

**Interfaces:**
- Produces: `packsForTrail<T extends { id: string }>(items: T[], trailId: number): { pack: T; styleId: string }[]` from `src/map/offline/packId.ts`.

- [ ] **Step 1: Write the failing test**

Add to `src/map/offline/__tests__/packId.test.ts`, matching its existing style:

```ts
describe('packsForTrail', () => {
  test('keeps the matching packs with their parsed style', () => {
    const items = [
      { id: 'offline:7:outdoors', state: 'complete' },
      { id: 'offline:7:satellite', state: 'error' },
      { id: 'offline:9:outdoors', state: 'complete' },
    ]
    expect(packsForTrail(items, 7)).toEqual([
      { pack: items[0], styleId: 'outdoors' },
      { pack: items[1], styleId: 'satellite' },
    ])
  })

  test('drops ids belonging to another trail', () => {
    expect(packsForTrail([{ id: 'offline:9:outdoors' }], 7)).toEqual([])
  })

  test('drops ids that do not parse', () => {
    expect(packsForTrail([{ id: 'not-a-pack-id' }], 7)).toEqual([])
  })
})
```

If `offline:7:outdoors` is not this project's real id format, read `packId.ts` and use the real one — do not change `packId.ts` to match the test.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/map/offline/__tests__/packId.test.ts`
Expected: FAIL — `packsForTrail` is not exported.

- [ ] **Step 3: Add the helper**

Append to `src/map/offline/packId.ts`:

```ts
export function packsForTrail<T extends { id: string }>(
  items: T[],
  trailId: number,
): { pack: T; styleId: string }[] {
  const matches: { pack: T; styleId: string }[] = []
  for (const item of items) {
    const parsed = parsePackId(item.id)
    if (parsed?.trailId === trailId) matches.push({ pack: item, styleId: parsed.styleId })
  }
  return matches
}
```

- [ ] **Step 4: Route the four call sites through it**

`src/map/offline/badge.ts` — replace the body of `offlineStateForTrail`. Keep the existing `// Any failure outranks…` comment exactly where it is, word for word.

```ts
  const live = packsForTrail(
    Object.entries(progress).map(([id, p]) => ({ id, ...p })),
    trailId,
  )
  const liveIds = new Set(live.map(({ pack }) => pack.id))
  const trailPacks = packsForTrail(packs, trailId)

  const stalled = trailPacks.filter(
    ({ pack }) => !liveIds.has(pack.id) && (pack.state === 'error' || pack.state === 'incomplete'),
  )
  if (live.some(({ pack }) => pack.failed) || stalled.length) return { kind: 'failed' }

  const active = live.filter(({ pack }) => pack.percentage < 100)
  if (active.length) {
    const pct = Math.round(active.reduce((s, { pack }) => s + pack.percentage, 0) / active.length)
    return { kind: 'downloading', pct, styleIds: active.map(({ styleId }) => styleId) }
  }

  const downloading = trailPacks.filter(
    ({ pack }) => !liveIds.has(pack.id) && pack.state === 'downloading',
  )
  if (downloading.length) {
    const pct = Math.round(
      downloading.reduce((s, { pack }) => s + pack.percentage, 0) / downloading.length,
    )
    return { kind: 'downloading', pct, styleIds: downloading.map(({ styleId }) => styleId) }
  }

  const complete = trailPacks.filter(({ pack }) => pack.state === 'complete')
  if (complete.length) {
    return { kind: 'available', styleIds: complete.map(({ styleId }) => styleId) }
  }
  return { kind: 'none' }
```

`src/map/offline/operations.ts` — hoist one call and use it for both the registry set and the error scan:

```ts
  const trailPacks = packsForTrail(packs, trailId)
  const registryStyleIds = new Set(trailPacks.map(({ styleId }) => styleId))
  const styleIds = new Set<string>()
  for (const { pack, styleId } of trailPacks) {
    if (pack.state === 'error' || pack.state === 'incomplete') styleIds.add(styleId)
  }
  for (const { pack, styleId } of packsForTrail(
    Object.entries(progress).map(([id, p]) => ({ id, ...p })),
    trailId,
  )) {
    if (pack.failed) styleIds.add(styleId)
  }
```

`src/map/offline/OfflineLayerChooser.tsx`:

```ts
          packsForTrail(packs, trail.id)
            .filter(({ pack }) => pack.state === 'complete')
            .map(({ styleId }) => styleId),
```

Afterwards there must be **zero** `parsePackId(...)!` in the codebase. Check with:
```bash
grep -rn 'parsePackId(.*)!' src app
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest src/map/offline`
Expected: PASS, with `badge.test.ts` and `operations.test.ts` **unchanged**. If either needs an assertion edited, stop — that means behaviour moved.

- [ ] **Step 6: Verify and commit**

Run: `npm run verify` — green, +3 tests from Task 1's total.

```bash
git add src/map/offline
git commit -m "refactor(offline): parse each pack id once instead of filtering then asserting"
```

---

### Task 3: DUP-11 — make the formatter mirror a mirror

**Files:**
- Modify: `src/trails/format.ts`, `src/trails/TrailInfoSheet.tsx`, `src/trails/TrailListItem.tsx`
- Test: `src/trails/__tests__/format.test.ts`

**Interfaces:**
- Produces: `formatTrailSummary` replaces `formatMetricsSummary` in `src/trails/format.ts`. No other task consumes it.

- [ ] **Step 1: Update the test first**

In `src/trails/__tests__/format.test.ts`, rename every reference and change the expected separator from `•` to `·`. Both changes, in the same edit — the test is the specification of both.

**The separator characters matter and are easy to confuse.** The one being removed is U+2022 BULLET (`•`); the one going in is U+00B7 MIDDLE DOT (`·`). After editing, prove you wrote the right byte:

```bash
grep -o '·' src/trails/__tests__/format.test.ts | head -1 | hexdump -C
```

Expected: `c2 b7` (U+00B7). If you see `e2 80 a2`, that is still the bullet — fix it.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/trails/__tests__/format.test.ts`
Expected: FAIL — on the missing export, and on the separator.

- [ ] **Step 3: Rename and change the separator**

In `src/trails/format.ts`, rename the function and swap both separators:

```ts
export function formatTrailSummary(metrics: TrailMetrics): string {
  const distance = formatDistance(metrics.distanceMeters)
  return metrics.elevationGainMeters === null
    ? `${distance} · no elevation data`
    : `${distance} · ${formatElevation(metrics.elevationGainMeters)} gain`
}
```

Both branches get the new separator — the `no elevation data` branch is easy to miss.

Update the two call sites in `TrailInfoSheet.tsx` and `TrailListItem.tsx` (each has an import and one use).

Confirm the old name is gone everywhere:
```bash
grep -rn 'formatMetricsSummary' src app docs
```
Expected: no hits in `src` or `app`. Hits in `docs/reviews` are the finding's own text — leave those alone, Task 5 handles the documents.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/trails`
Expected: PASS.

- [ ] **Step 5: Verify and commit**

Run: `npm run verify` — green, same test count as Task 2 (a rename adds none).

```bash
git add src/trails
git commit -m "refactor(trails): name the summary by its domain and match the activity separator"
```

---

### Task 4: DUP-5 — delete the theme token with one consumer

**Files:**
- Modify: `src/theme/colors.ts`, `src/map/MapControls.tsx`

**Interfaces:** none — `controlsText` ceases to exist.

- [ ] **Step 1: Point the label at the sibling token**

In `src/map/MapControls.tsx`, the 2D/3D label reads `c.controlsText`. Change it to `c.controlContent` — the token its four sibling icons in the same control cluster already use.

- [ ] **Step 2: Delete the token**

In `src/theme/colors.ts`, remove all three `controlsText` lines: the interface field, the light value (`'#000000'`), and the dark value (`'#FFFFFF'`).

In dark theme this changes nothing — `controlContent` is also `#FFFFFF`. In light theme the label moves from `#000000` to `#1C1B1F`, which is the intent.

- [ ] **Step 3: Prove it is gone**

```bash
grep -rn 'controlsText' src app docs
```
Expected: no hits in `src` or `app`. If a theme test enumerates tokens, it will fail to compile — that is the gate working; update the test to drop the token.

- [ ] **Step 4: Verify and commit**

Run: `npm run verify`
Expected: green. `tsc` is the real check here — any missed reference is a type error.

```bash
git add src/theme src/map
git commit -m "refactor(theme): drop the second token for control text"
```

---

### Task 5: close the four findings in the review documents

**Files:**
- Modify: `docs/reviews/2026-09-10-full-review.md`, `docs/reviews/2026-10-06-open-work.md`

**Interfaces:** none — documentation only.

- [ ] **Step 1: Tick the four findings**

Append a `· **Done** (<commit>): <what changed>` clause to DUP-1, DUP-5, DUP-7 and DUP-11 in `docs/reviews/2026-09-10-full-review.md`, in the style the already-closed findings use. Get each commit hash from `git log --oneline` — verify each hash actually contains the change it is cited for with `git show --stat <hash>`, because misattributed commits have been a recurring defect in these documents.

**On DUP-11, say plainly that the separator has not been looked at on a device.** The reasoning for choosing `·` is that it already ships in the identical `EntityListItem` component via `formatActivitySummary` — that is strong evidence, not verification, and the document must not claim more than was done.

- [ ] **Step 2: Correct the dashboard and the index**

The Duplication row currently reads `0 / 1 / 6`. Enumerate the open DUP findings yourself from the document and set the true value — do not assume the arithmetic. Update the row's Status cell and its Summary text if either is now wrong, and remove anything the Summary names that is now closed.

Note the convention line above the table: counts are *open* findings.

In `docs/reviews/2026-10-06-open-work.md`, remove the closed findings from the "outside the table" list, add "Closed below" entries, and recount every number this makes wrong — the outside-the-table count, the "others" count, and the total. Derive each by enumerating. DUP-1 is a **should-fix in the table (row 9)**, not an outside-the-table item, so check which list each of the four actually belongs to before editing.

- [ ] **Step 3: Record what was deliberately not done**

Add a short note to `docs/reviews/2026-10-06-open-work.md` recording that DUP-6 was left alone because the finding itself rules "accept — extract only if a third entity store appears", so the correct action is none. Without this, the next reader sees four of five DUP items closed and will wonder if DUP-6 was missed.

- [ ] **Step 4: Verify and commit**

Run: `npm run verify` — green, unchanged counts.

```bash
git add docs/reviews
git commit -m "docs(reviews): close dup-1, dup-5, dup-7 and dup-11"
```
