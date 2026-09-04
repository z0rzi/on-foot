# Elevation Noise Filter Implementation Plan

**Goal:** Report elevation gain/loss that reflects the terrain walked, not altitude-sensor noise: smooth the elevation series over a distance window, then accumulate with a hysteresis deadband. One algorithm, applied wherever gain is derived (`computeMetrics`).

**Design:** `docs/superpowers/specs/2026-09-04-onfoot-rn-elevation-noise-filter-design.md`

**Architecture:** A new pure module `src/data/trails/gpx/elevationFilter.ts` owns the two stages and the two constants. `computeMetrics` keeps ownership of distance and of splitting a point list into elevation runs (breaks at null elevations); it delegates each run's gain/loss to the filter. No other production file changes: every gain surface already routes through `computeMetrics` / `metricsForSegments`.

**Tech Stack:** React Native (Expo v57), TypeScript (strict), Jest (jest-expo preset).

## Global Constraints

- **Pure logic is TDD'd** — tests written before implementation, asserting behaviour (numbers), not structure.
- **Layering:** filter is pure arithmetic in the data layer; no I/O, no UI, no new dependency direction, no seam touched.
- **No change-narrating comments.** Comment only the non-obvious *why*.
- **Gates:** `npx tsc --noEmit`, `npx jest`, `npx expo lint` (i.e. `npm run verify`).
- **Commit style:** Conventional Commits, lowercase, scoped — matching history.

---

## File Structure

**New (pure, TDD):**
- `src/data/trails/gpx/elevationFilter.ts` — `ELEVATION_SMOOTHING_WINDOW_METERS`, `ELEVATION_DEADBAND_METERS`, `ElevationPoint`, `ElevationChange`, `smoothElevationSeries`, `accumulateGainLoss`, `elevationChange`.
- `src/data/trails/__tests__/elevationFilter.test.ts`

**Changed:**
- `src/data/trails/gpx/metrics.ts` — `computeMetrics` builds elevation runs and delegates to `elevationChange`.
- `src/data/trails/__tests__/metrics.test.ts` — the coincident-points case is rewritten with spaced points; a standstill case is added.

**Docs:** spec + this plan.

---

## Task 1 — `smoothElevationSeries` (distance-window moving average)

- [x] Tests: empty and single-sample input; `windowMeters <= 0` is identity; a spike between flat neighbours is pulled toward them; samples further apart than the window stay independent; a cluster at one distance averages to one constant; a run keeps its first and last elevation; a monotone ramp stays increasing and keeps its total rise.
- [x] Implement with a two-pointer sliding window over non-decreasing distances (O(n)), the reach at each sample being `min(window/2, distance from the run's start, distance to its end)` so the window stays centred and never leans inward at the ends.
- [x] Verify: `npx jest src/data/trails`

## Task 2 — `accumulateGainLoss` (hysteresis deadband)

- [x] Tests: empty/single → `{0, 0}`; oscillation below the deadband → `{0, 0}`; monotone climb counted exactly regardless of step size; climb then confirmed descent counts both in full (including the threshold portion of the drop); a sub-deadband dip inside a climb does not split it; the descent-first mirror is symmetric; the first swing is measured from its own extreme; the same swings read the same wherever the series starts within them.
- [x] Implement the reference-plus-extremes walk from the design.
- [x] Verify: `npx jest src/data/trails`

## Task 3 — `elevationChange` composition

- [x] Tests: composition equals smooth-then-accumulate with the module constants; a flat 5 km of correlated (AR(1)) wander reports under a quarter of the raw sum; a real 300 m climb in the same wander is recovered within 10 %.
- [x] Implement `elevationChange(samples)` = `accumulateGainLoss(smoothElevationSeries(samples, WINDOW), DEADBAND)`.
- [x] Verify: `npx jest src/data/trails`

## Task 4 — Calibrate the constants

- [x] Sweep `W ∈ {50, 100, 150, 200, 300}` × `T ∈ {2, 3, 5, 8}` over simulated tracks (flat, standstill, long climb, out-and-back, fine ripple, short steep climb) at three noise levels including correlated AR(1) error, comparing against the noise-free truth.
- [x] Record the table and the choice (`W = 150`, `T = 3`) in the design doc, with the caveat that it is simulated noise, not this device's.
- [x] Delete the sweep harness; it is a calibration tool, not a test of behaviour.

## Task 5 — Wire into `computeMetrics`

- [x] Update `src/data/trails/__tests__/metrics.test.ts`: replace the coincident-points gain/loss case with spaced points (same 30 m up / 20 m down intent); add the standstill case (fixes ~11 m apart with a wandering altitude — what the OS actually delivers when the walker stops); keep the null-handling and no-elevation cases passing unchanged.
- [x] Rewrite `computeMetrics` to accumulate distance while collecting runs of consecutive elevated points as `{ distance, ele }`, breaking at nulls, then sum `elevationChange` over the runs. `metricsForSegments` is unchanged.
- [x] Verify: `npx jest` — in particular `src/data/activities/__tests__/mapping.test.ts` (`activityMetricsFromSegments` asserts gain 10 / loss 5) and `src/data/trails/__tests__/mapping.test.ts`, the tests that would catch a changed number.

## Task 6 — Gates & review

- [x] `npx tsc --noEmit`, `npx jest`, `npx expo lint` all clean (lint: 0 errors; the 32 warnings are the pre-existing baseline).
- [x] Confirm no other call site needed changing: `grep -rn "computeMetrics\|metricsForSegments" src app`.
- [x] Post-work quality control per `POST-WORK.md`, then `/if-from-zero`.

## Deferred, named in the design

- Reconcile `smoothProfile` (`feat/elevation-graph`) onto `smoothElevationSeries` once that branch merges.
- Re-calibrate the two constants against captured real tracks.
- Filter the same jitter out of **distance** (`tasks.md`: "smoothen activity").
