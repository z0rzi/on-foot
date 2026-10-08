# Presentation Formatters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the four presentation formatters out of the data layer into modules organised by role, and gate the layering so it cannot regress.

**Architecture:** `src/format/units.ts` takes the three pure unit→string formatters (`formatDistance`, `formatElevation`, `formatBytes`). `src/trails/format.ts` takes `formatMetricsSummary`, mirroring the existing `src/activities/format.ts`. `src/data/geo/metrics.ts` keeps only computation. A new `IMPORT_RULES` entry stops the data layer importing the formatters again.

**Tech Stack:** TypeScript 6, React Native 0.86.2 (Expo SDK 57), Jest 29 via jest-expo.

**Spec:** `docs/superpowers/specs/2026-10-08-presentation-formatters-design.md`

## Global Constraints

- **Pure relocation. No function body changes.** Every formatter is moved verbatim — no string, rounding, threshold or name is edited. Nothing on screen changes.
- **Never leave a formatter in two places, even between commits.** `DUPLICATION_WINDOW` is 8 lines (`src/architecture/duplication.ts:9`) and the duplication gate is part of `npm run verify`. Each task below is a *complete* move: create-and-delete in the same commit, never copy-then-delete-later. This is why the tasks are split by symbol rather than by "create new files" / "delete old files".
- **The data layer must never import the new formatter modules.** Task ordering guarantees this: `formatMetricsSummary` moves out *before* the unit formatters do, so `data/geo/metrics.ts` never needs to import them.
- **No JSDoc** (AGENTS.md). Comments explain *why*, never what changed.
- **Commit subjects:** lowercase, conventional-commit prefix, ONE line, no body.
- `npm run verify` (tsc + jest + expo lint) must be green at the end of every task.
- **Baseline, measured 2026-10-08: 67 suites / 566 tests.** Expected after each task: Task 1 → 68/570, Task 2 → 69/570, Task 3 → 69/570, Task 4 → 69/570.
- **No device check is needed for this change** and none is possible this session. Every formatter is pure and covered by Jest; nothing touches map rendering, camera, or gestures.

---

### Task 1: `formatBytes` moves to a new units module

**Files:**
- Create: `src/format/units.ts`
- Create: `src/format/__tests__/units.test.ts`
- Delete: `src/map/offline/format.ts`
- Modify: `src/map/offline/OfflineMapsList.tsx:10`, `src/map/offline/downloadConsent.ts:5`, `src/map/offline/OfflineLayerChooser.tsx:14`

**Interfaces:**
- Produces: `src/format/units.ts` exporting `formatBytes(bytes: number): string`. Tasks 3 and 4 append to and reference this same file.

`formatBytes` goes first because it is the only formatter with no current test — writing its tests is real TDD rather than relocation, and it establishes the new module that Task 3 extends.

- [ ] **Step 1: Write the failing test**

Create `src/format/__tests__/units.test.ts`:

```ts
import { formatBytes } from '../units'

describe('formatBytes', () => {
  it('uses GB at a billion bytes and above, to one decimal', () => {
    expect(formatBytes(1_000_000_000)).toBe('1.0 GB')
    expect(formatBytes(1_500_000_000)).toBe('1.5 GB')
  })

  it('uses whole MB from a million bytes up to a billion', () => {
    expect(formatBytes(1_000_000)).toBe('1 MB')
    expect(formatBytes(5_400_000)).toBe('5 MB')
  })

  it('uses whole KB below a million bytes', () => {
    expect(formatBytes(250_000)).toBe('250 KB')
  })

  it('never reports 0 KB, because a pack that exists is not nothing', () => {
    expect(formatBytes(200)).toBe('1 KB')
    expect(formatBytes(0)).toBe('1 KB')
  })
})
```

The last test is the point of TEST-1: `Math.max(1, …)` is a deliberate clamp, and without a test nothing stops someone "simplifying" it away.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/format/__tests__/units.test.ts`
Expected: FAIL — `Cannot find module '../units'`.

- [ ] **Step 3: Create the module with the body moved verbatim**

Create `src/format/units.ts`. Copy the body from `src/map/offline/format.ts` without editing it:

```ts
export function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`
  if (bytes >= 1_000_000) return `${Math.round(bytes / 1_000_000)} MB`
  return `${Math.max(1, Math.round(bytes / 1000))} KB`
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/format/__tests__/units.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Delete the old module and repoint its three consumers**

Delete `src/map/offline/format.ts` entirely. Then change the import in each of these three files from `'./format'` to `'../../format/units'`:

- `src/map/offline/OfflineMapsList.tsx:10` → `import { formatBytes } from '../../format/units'`
- `src/map/offline/downloadConsent.ts:5` → `import { formatBytes } from '../../format/units'`
- `src/map/offline/OfflineLayerChooser.tsx:14` → `import { formatBytes } from '../../format/units'`

Deleting in the same commit is what keeps the duplication gate green — see Global Constraints.

- [ ] **Step 6: Verify**

Run: `npm run verify`
Expected: green, **68 suites / 570 tests**.

- [ ] **Step 7: Commit**

```bash
git add src/format src/map/offline
git commit -m "refactor(format): move formatBytes to a units module and cover its clamp"
```

---

### Task 2: `formatMetricsSummary` moves beside its activity counterpart

**Files:**
- Create: `src/trails/format.ts`
- Create: `src/trails/__tests__/format.test.ts`
- Modify: `src/data/geo/metrics.ts:79-84` (remove the function), `src/data/geo/__tests__/metrics.test.ts` (remove its two tests)
- Modify: `src/trails/TrailInfoSheet.tsx:6`, `src/trails/TrailListItem.tsx:2`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `src/trails/format.ts` exporting `formatMetricsSummary(metrics: TrailMetrics): string`.

This moves **before** the unit formatters deliberately. `formatMetricsSummary` calls `formatDistance` and `formatElevation`; while those still live in `data/geo/metrics.ts`, the new file imports them from there — trails importing data, which is the correct direction. Doing it the other way round would force `data/geo/metrics.ts` to import the presentation module, which is the very thing this work removes.

- [ ] **Step 1: Write the failing test**

Create `src/trails/__tests__/format.test.ts`. These two cases move verbatim from `src/data/geo/__tests__/metrics.test.ts`:

```ts
import { formatMetricsSummary } from '../format'

describe('formatMetricsSummary', () => {
  test('includes gain when known', () => {
    expect(formatMetricsSummary({ distanceMeters: 1500, elevationGainMeters: 340, elevationLossMeters: 300 }))
      .toBe('1.5 km • 340 m gain')
  })
  test('states when elevation is missing', () => {
    expect(formatMetricsSummary({ distanceMeters: 1500, elevationGainMeters: null, elevationLossMeters: null }))
      .toBe('1.5 km • no elevation data')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/trails/__tests__/format.test.ts`
Expected: FAIL — `Cannot find module '../format'`.

- [ ] **Step 3: Create the module with the body moved verbatim**

Create `src/trails/format.ts`:

```ts
import type { TrailMetrics } from '../data/trails/types'
import { formatDistance, formatElevation } from '../data/geo/metrics'

export function formatMetricsSummary(metrics: TrailMetrics): string {
  const distance = formatDistance(metrics.distanceMeters)
  return metrics.elevationGainMeters === null
    ? `${distance} • no elevation data`
    : `${distance} • ${formatElevation(metrics.elevationGainMeters)} gain`
}
```

`TrailMetrics` is declared in `src/data/trails/types.ts` (verified), so `'../data/trails/types'` is the correct path from `src/trails/`. Task 3 repoints the `formatDistance`/`formatElevation` import in this file.

- [ ] **Step 4: Remove it from the data layer in the same commit**

In `src/data/geo/metrics.ts`, delete the whole `formatMetricsSummary` function (lines 79-84) and nothing else. `formatDistance` and `formatElevation` stay for now — Task 3 moves them.

In `src/data/geo/__tests__/metrics.test.ts`, delete the two `formatMetricsSummary` tests from the `describe('formatters', …)` block and drop `formatMetricsSummary` from the import on line 1. The block keeps its three remaining tests; do not delete the block yet.

- [ ] **Step 5: Repoint the two consumers**

- `src/trails/TrailListItem.tsx:2` — change to `import { formatMetricsSummary } from './format'`
- `src/trails/TrailInfoSheet.tsx:6` — this import is **split**, because it also brings in two formatters that have not moved yet. Replace the single line with:

```tsx
import { formatDistance, formatElevation } from '../data/geo/metrics'
import { formatMetricsSummary } from './format'
```

- [ ] **Step 6: Verify**

Run: `npm run verify`
Expected: green, **69 suites / 570 tests** (the two tests moved between files, so the total is unchanged).

- [ ] **Step 7: Commit**

```bash
git add src/trails src/data/geo
git commit -m "refactor(trails): move the metrics summary beside the activity formatter"
```

---

### Task 3: the unit formatters leave the data layer

**Files:**
- Modify: `src/format/units.ts` (append two functions), `src/format/__tests__/units.test.ts` (append three tests)
- Modify: `src/data/geo/metrics.ts:71-77` (remove both functions), `src/data/geo/__tests__/metrics.test.ts` (remove the now-empty formatters block)
- Modify eight import sites: `src/activities/ActivityForm.tsx:4`, `src/activities/format.ts:2`, `src/elevation/ElevationGraph.tsx:9`, `src/map/ActivityInfoSheet.tsx:11`, `src/recording/RecordingInfoSheet.tsx:7`, `src/trails/TrailForm.tsx:4`, `src/trails/TrailInfoSheet.tsx`, `src/trails/format.ts`

**Interfaces:**
- Consumes: `src/format/units.ts` from Task 1; `src/trails/format.ts` from Task 2.
- Produces: `src/format/units.ts` additionally exporting `formatDistance(meters: number): string` and `formatElevation(meters: number | null): string`. After this task `src/data/geo/metrics.ts` exports only `haversineMeters`, `computeMetrics` and `metricsForSegments`.

- [ ] **Step 1: Write the failing tests**

Append to `src/format/__tests__/units.test.ts`, adding `formatDistance, formatElevation` to the existing import from `'../units'`. These three cases move verbatim from `src/data/geo/__tests__/metrics.test.ts`:

```ts
describe('formatDistance', () => {
  test('switches to km at 1000 m', () => {
    expect(formatDistance(450)).toBe('450 m')
    expect(formatDistance(1500)).toBe('1.5 km')
    expect(formatDistance(1000)).toBe('1.0 km')
  })
})

describe('formatElevation', () => {
  test('rounds to whole metres', () => {
    expect(formatElevation(250.4)).toBe('250 m')
  })
  test('shows a dash when elevation is unknown', () => {
    expect(formatElevation(null)).toBe('—')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/format/__tests__/units.test.ts`
Expected: FAIL — `formatDistance is not a function` (or a TypeScript error that the module has no such export).

- [ ] **Step 3: Move both bodies verbatim**

Append to `src/format/units.ts`, copied without edits from `src/data/geo/metrics.ts:71-77`:

```ts
export function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters.toFixed(0)} m`
}

export function formatElevation(meters: number | null): string {
  return meters === null ? '—' : `${meters.toFixed(0)} m`
}
```

Delete both functions from `src/data/geo/metrics.ts` in this same commit.

- [ ] **Step 4: Clean up the old test file**

In `src/data/geo/__tests__/metrics.test.ts`, the `describe('formatters', …)` block is now empty — delete the whole block, and remove `formatDistance, formatElevation` from the import on line 1. The file keeps its `haversineMeters`, `computeMetrics` and `metricsForSegments` coverage.

- [ ] **Step 5: Repoint all eight import sites**

Six are whole-line replacements to `'../format/units'`:

- `src/activities/ActivityForm.tsx:4` → `import { formatDistance, formatElevation } from '../format/units'`
- `src/activities/format.ts:2` → `import { formatDistance } from '../format/units'`
- `src/elevation/ElevationGraph.tsx:9` → `import { formatDistance, formatElevation } from '../format/units'`
- `src/map/ActivityInfoSheet.tsx:11` → `import { formatDistance, formatElevation } from '../format/units'`
- `src/trails/TrailForm.tsx:4` → `import { formatDistance, formatElevation } from '../format/units'`
- `src/trails/TrailInfoSheet.tsx` → the `from '../data/geo/metrics'` line added in Task 2 becomes `import { formatDistance, formatElevation } from '../format/units'`

Two are **not**, and are where a blind search-and-replace breaks the build:

- `src/recording/RecordingInfoSheet.tsx:7` imports `metricsForSegments` too, and that is **staying** in the data layer. Replace the one line with two:

```tsx
import { metricsForSegments } from '../data/geo/metrics'
import { formatDistance, formatElevation } from '../format/units'
```

- `src/trails/format.ts` (created in Task 2) imports both formatters from `'../data/geo/metrics'`. Change that line to `import { formatDistance, formatElevation } from '../format/units'`.

- [ ] **Step 6: Verify**

Run: `npm run verify`
Expected: green, **69 suites / 570 tests**.

Then confirm the data layer is clean:

```bash
grep -rn "formatDistance\|formatElevation\|formatMetricsSummary\|formatBytes" src/data/
```

Expected: no output at all.

- [ ] **Step 7: Commit**

```bash
git add src/format src/data/geo src/activities src/elevation src/map src/recording src/trails
git commit -m "refactor(format): move the unit formatters out of the data layer"
```

---

### Task 4: gate the layering, then close the findings

**Files:**
- Modify: `src/architecture/importRules.ts` (append one rule to `IMPORT_RULES`)
- Modify: `docs/reviews/2026-09-10-full-review.md`, `docs/reviews/2026-10-06-open-work.md`

**Interfaces:**
- Consumes: the finished move from Tasks 1-3.
- Produces: nothing other tasks depend on.

- [ ] **Step 1: Add the import rule**

Append to `IMPORT_RULES` in `src/architecture/importRules.ts`, following the shape of the existing entry exactly:

```ts
  {
    within: 'src/data/',
    mustNotImport: 'format/units',
    rationale:
      'The data layer computes and persists; turning a value into a string for the screen is presentation. Formatters living in data/geo is what ARCH-1 was, and this rule is what stops it coming back.',
  },
```

- [ ] **Step 2: Prove the rule actually fires**

A rule that cannot fail is worth nothing. Temporarily add `import { formatDistance } from '../../format/units'` to `src/data/geo/metrics.ts`, then run:

Run: `npx jest src/architecture`
Expected: FAIL, naming `src/data/geo/metrics.ts` and the new rationale.

Then remove that temporary import and re-run:

Run: `npx jest src/architecture`
Expected: PASS.

Put both outputs in your report.

- [ ] **Step 3: Close ARCH-1 in the authoritative review**

In `docs/reviews/2026-09-10-full-review.md`, append to the ARCH-1 entry in the style the other closed findings use: `· **Done** (<commit>): the three formatters now live in \`src/format/units.ts\` and \`src/trails/format.ts\`; \`src/map/offline/format.ts\` is gone; an \`IMPORT_RULES\` entry keeps the data layer out of them.`

- [ ] **Step 4: Mark TEST-1 partially done — do not close it**

TEST-1 also covers `packDescriptor` and lifting `guardDownload` into a pure `downloadDecision`. Neither was touched. Append to the TEST-1 entry: `· **Partly done** (<commit>): \`formatBytes\` now has tests covering its three unit boundaries and the \`Math.max(1, …)\` clamp, moved to \`src/format/units.ts\`. The \`packDescriptor\` and \`downloadDecision\` clauses remain open.`

Do not tick TEST-1 as done anywhere, and do not remove it from the open lists.

- [ ] **Step 5: Update the dashboard and the open-work index**

In `docs/reviews/2026-09-10-full-review.md`, the "Architecture & seams" dashboard row counts ARCH-1 as a should-fix; decrement that count and remove the phrase describing it from that row's summary.

In `docs/reviews/2026-10-06-open-work.md`:
- Remove row 8 from the backlog table, leaving rows 9 and 10.
- Add a "Closed below" entry, newest first, naming what changed and the commit, and say plainly that TEST-1 is only half closed.
- Correct every count this makes wrong. Derive them from the current text rather than assuming: ARCH-1 closes, TEST-1 stays open, no finding is added. Check the header's open-finding totals, the in-table count, and the outside-the-table list and count.

- [ ] **Step 6: Verify**

Run: `npm run verify`
Expected: green, **69 suites / 570 tests**.

- [ ] **Step 7: Commit**

```bash
git add src/architecture docs/reviews
git commit -m "refactor(architecture): gate the data layer against the formatters"
```
