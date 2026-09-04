# Elevation Noise Filter — Trustworthy Gain & Loss — Design

**Status:** Approved design
**Branch:** `feat/elevation-noise-filter`
**Date:** 2026-09-04

## Goal

Make reported **elevation gain / loss** reflect the terrain actually walked, not
the noise of the altitude sensor. Today `computeMetrics` sums every positive
per-point delta, so a flat walk on a noisy GPS fix reports hundreds of metres of
climb: an altitude that oscillates ±4 m around a constant level accumulates that
oscillation once per sample, forever.

The fix is the one named in `tasks.md`: **smooth, then apply a deadband**, and
combine both.

## Scope

One shared algorithm for the whole app. `computeMetrics` is the single place
elevation gain is derived (trail import preview, saved trail rows, the live
recording sheet, and the metrics stored with a saved activity all route through
it or through `metricsForSegments`), so filtering there fixes every surface at
once.

**Applies to imported trails too — deliberately.** Gain must mean the same thing
everywhere or the app's core comparison ("the trail says 300 m, my recording of
it says 700 m") is meaningless. GPX from consumer devices is as noisy as a live
recording; on clean survey-grade data the filter is close to a no-op (measured:
a clean 500 m climb reads 500 m, a clean 300 m out-and-back reads 298 m).

**Out of scope / deliberate non-goals:**
- **Re-deriving elevation from map/DEM data** (the `tasks.md` "calculate on map
  data?" question). A separate feature with a network/offline story, sharing a
  task with "compute elevation for GPX files that lack it".
- **Back-filling already-saved rows.** Metrics are computed once, at import/save
  time, and stored; `TrailUpdate` never recomputes them, so old rows cannot
  silently change. Existing trails and activities keep their old (inflated)
  numbers; only new ones are filtered. A recompute migration would have to
  re-read every stored geometry and is not worth the risk for a historical
  cosmetic fix.
- **A user-facing setting.** Gain is a fact about the walk, not a display
  preference: two people who walked the same trail must not read different
  numbers because one changed a slider. (`elevationSmoothingMeters` in
  preferences is a *drawing* choice for the profile graph — see "Relationship to
  the elevation graph" below.) The constants are fixed and documented here.
- **Distance jitter.** Horizontal noise inflates distance the same way altitude
  noise inflates gain — a standstill accumulates travelled metres it never
  walked. Same root cause, different filter (it needs the "smoothen activity /
  detect GPS jumps" task in `tasks.md`), and out of scope here. Named, not
  dismissed: gain is now the trustworthy metric and distance is not yet.

## Global Constraints

- **Pure logic is TDD'd.** The filter is pure arithmetic over an array — Jest
  tests first, no device verification needed for the numbers themselves.
- **Layering:** the filter is a pure sibling of `metrics.ts` in
  `src/data/trails/gpx/`, imported by it. No new dependency direction, no UI or
  I/O in the data layer, no seam touched.
- **No change-narrating comments.**

## The algorithm

Two stages, applied per **elevation run** (see below):

### 1. Distance-window moving average

Each sample's elevation is replaced by the mean of the samples within
`±WINDOW/2` **metres of travelled distance** (not ±N samples). Distance is the
right unit because it makes the cutoff independent of how densely the source
sampled: a 1 Hz GPX, a 10 m-gated live recording and a sparse waypoint track all
get the same physical smoothing length.

**The window never reaches past either end of its run.** At a sample `d` from the
start of a run the reach is `min(WINDOW/2, d - first, last - d)`, so the window
stays *centred* and shrinks near the ends instead of leaning inward. A one-sided
window at the ends would drag a run's first and last elevations toward its middle
and shave a slope-proportional slice off every run's real gain — measured at
`WINDOW = 150`: a genuine 300 m climb sampled over 300 m of trail read **38 m**
with a leaning window and **50 m** (its true value) with this one. That bias is
systematic and repeats per segment; the price paid instead is that the first and
last sample of a run keep their own measurement noise.

Implemented with a two-pointer sliding window (O(n)): both bounds are monotone in
`i`, and the recording sheet recomputes metrics over the whole track on every
incoming batch, so a quadratic scan would be felt on a long hike.

### 2. Deadband with hysteresis

Sum gain/loss over the smoothed series, carrying a committed reference level, the
extremes seen since that commit, and a direction:

```
reference = low = high = e0, dir = 0
for each e:
  dir > 0 and e > reference   -> gain += e - reference;  commit(e)
  dir < 0 and e < reference   -> loss += reference - e;  commit(e)
  e - low  >= T              -> gain += e - low;  loss += max(0, reference - low);  commit(e); dir = +1
  high - e >= T              -> loss += high - e; gain += max(0, high - reference); commit(e); dir = -1
  otherwise                  -> low = min(low, e); high = max(high, e)

commit(e): reference = low = high = e
```

**Hysteresis, not a per-delta deadband.** Dropping deltas below `T` one at a time
still counts a climb correctly, but it also lets a slow drift of sub-`T` steps
accumulate without bound — the exact flat-walk failure. Requiring a *reversal* to
exceed `T` means an oscillation whose peak-to-valley span stays under `T`
contributes nothing at all, while a genuine climb is still counted to the metre
(the increments while `dir = +1` telescope to the true total rise). When a
reversal is confirmed the whole drop is counted, threshold included — the drop
really happened, it just needed confirming.

**Why the extremes, and not just the reference.** Once a direction is held the
reference *is* the running extreme (every new high is committed), so a reversal is
always measured from the peak or the valley. Before the first commit it is not:
anchoring on `e0` alone would measure the first swing from wherever the track
happened to start, and a track that oscillates within `±T` of its first sample
would never commit at all — a ±5 m rolling profile read **0 m** of gain that way
with `T = 8`. Tracking `low`/`high` from the first sample makes the very first
swing behave exactly like every later one, and the `max(0, …)` corrections book
the excursion that preceded it, keeping the invariant `gain − loss = reference −
e0`.

### Constants

| constant | value |
|---|---|
| `ELEVATION_SMOOTHING_WINDOW_METERS` | 150 |
| `ELEVATION_DEADBAND_METERS` | 3 |

Chosen by sweeping `W ∈ {50…300}` × `T ∈ {2…8}` over simulated tracks (10 m
fixes; clean, white σ=3 m, and correlated AR(1) σ=5 m ρ=0.9 / σ=8 m ρ=0.95
altitude error — real GPS altitude error *wanders*, which a short window cannot
remove). Reported gain, truth in brackets:

| track | raw sum | W=50 T=3 | **W=150 T=3** | W=300 T=3 |
|---|---|---|---|---|
| flat 10 km [0] | 1177 | 155 / 302 / 374 | **23 / 155 / 213** | 6 / 77 / 123 |
| 10 min standstill [0] | 44 | 10 / 12 / 14 | **4 / 7 / 11** | 4 / 7 / 11 |
| 500 m climb over 10 km [500] | 1443 | 510 / 610 / 675 | **501 / 513 / 548** | 501 / 501 / 507 |
| 300 m out-and-back [300] | 1202 | 307 / 391 / 448 | **300 / 307 / 332** | 297 / 296 / 298 |
| ±5 m ripple, 500 m wavelength [200] | 1192 | 254 / 354 / 411 | **184 / 230 / 268** | 103 / 123 / 156 |
| clean data (no noise) | — | exact | **exact except the ripple: 171 [200]** | ripple: 97 [200] |

150 m is the knee: it removes ~85 % of the phantom climb a raw sum reports, costs
essentially nothing on clean climbs of any length, and still resolves real relief
down to a ±5 m ripple (which it under-reads by ~15 %). 300 m removes more phantom
but starts erasing that real relief; 50 m leaves too much phantom in. `T = 3` m is
the `tasks.md` figure and the residual after smoothing; the sweep shows `T` is the
weaker of the two levers, and raising it is what destroys small real relief.

**These constants are calibrated against simulated noise, not against this
device.** The honest next step is to capture one flat walk and one hike of known
gain on the target phone, commit them as fixtures, and re-run the sweep — a
one-line change if the numbers disagree. Nothing else in the design depends on
their values.

### Elevation runs (null handling, unchanged semantics)

A point may have no elevation. Today a null breaks the pair and that delta is
skipped; bridging across it would invent gain over unknown ground. So within a
segment the points are split at nulls into **runs** of consecutive elevated
points, each run filtered independently and the results summed. A track with no
elevation at all still reports `null` gain/loss.

Segments already come in separately via `metricsForSegments`, so a run never
spans a recording break either.

## Relationship to the elevation graph (`feat/elevation-graph`)

That branch — in flight, not yet merged — introduces `src/elevation/slope.ts`
`smoothProfile`: the same centred distance-window average, over an
`ElevationProfile`, with a **user-tunable** window (`elevationSmoothingMeters`,
default 50) used for *drawing* the profile and colouring the route by slope.
After both land the app would carry two implementations of one idea.

They are not the same function today: `smoothProfile` breaks its window at
**segment** boundaries and ignores nulls; `smoothElevationSeries` takes a single
run (segments and nulls already split upstream) and never reaches past its ends.
The dependency direction already allows unification — `src/elevation/profile.ts`
imports from `src/data/trails/gpx/metrics` — so the data layer is the right owner.

**Follow-up, to be done when the two branches meet:** refactor `smoothProfile`
onto `smoothElevationSeries` (splitting per segment at the call site, as
`computeMetrics` splits per run), keeping the preference as what it is — the
*display* window — and leaving the metric window fixed. This is a deliberate,
named reconciliation, not two forks left to drift.

## Consequences accepted

- **A run's first and last sample keep their own noise.** The centred-and-shrunk
  window trades a systematic per-run under-report (see stage 1) for a random
  ±(one fix's error) at each run end, which survives the deadband when it exceeds
  3 m. Measured worst case on a deliberately adversarial fixture (a ±4 m square
  wave that both starts and ends on an extreme): 8 m over a 10-minute stop,
  against 80 m for the raw sum. Reflect-padding the ends would remove even that;
  it is a refinement, not a correction, and it is not worth the index arithmetic
  today.
- **The live gain tile is provisional and can tick down.** It recomputes over the
  whole track on every batch, and the newest samples are the least smoothed, so
  the figure settles as the walk continues. The number stored with the activity
  is computed once, over the finished track.
- **Fine relief is under-read by ~15 %** (a ±5 m ripple at a 500 m wavelength).
  Anything sharper or larger — the relief real trails are made of — survives.
- **Gain no longer equals the sum of the drawn profile's rises.** The graph draws
  the elevation as measured (or display-smoothed); the metric is filtered. Every
  GPS watch behaves this way, and it is the price of a trustworthy number.
- **Coincident points with a large altitude change are flattened.** A synthetic
  track that climbs 30 m without moving horizontally now reports ~0 gain. One
  existing test encoded that shape and is rewritten with spaced points — same
  intent, physical geometry.

## Known risk, to verify on device

`expo-location` on Android reads `location.altitude` with no `hasAltitude()` guard
(`node_modules/expo-location/android/…/LocationResults.kt`), and Android's
`Location.getAltitude()` returns **0.0** when altitude is unavailable. A fix
without altitude therefore reaches `toTrackPoint` as `0`, not `null`: it does not
break the elevation run, and a step of hundreds of metres to and from sea level is
far beyond any deadband, so this filter cannot remove it. The `.d.ts` types it as
`number | null`, so `tsc` and Jest (native module mocked) both stay green.

Pre-existing and outside this change, but it is the one thing that could defeat
"gain means the same thing everywhere". Device verification of this feature should
include one recording checked for `ele: 0` outliers; the fix, if confirmed, belongs
in `src/recording/track.ts` behind the recording seam (`altitudeAccuracy` is the
signal available on the payload).

## Test plan (Jest, written first)

`smoothElevationSeries`
- empty / single sample unchanged; window ≤ 0 is identity
- a spike between flat neighbours is pulled toward them
- samples further apart than the window do not influence each other
- a cluster of samples at one distance averages to a single constant
- a run keeps its first and last elevation, whatever the window
- a monotone ramp stays increasing and keeps its total rise exactly

`accumulateGainLoss`
- empty / single sample → 0 / 0
- oscillation below the deadband → 0 gain, 0 loss
- a monotone climb is counted exactly, whatever the step size
- a climb then a confirmed descent counts both in full
- a sub-deadband dip inside a climb does not split it
- descent-then-climb is the mirror image
- the first swing is measured from its own extreme, not from the first sample
- the same swings read the same wherever the series starts within them

`elevationChange`
- composition equals smooth-then-accumulate with the module constants
- a flat, correlated-noise 5 km reports under a quarter of the raw sum
- a real 300 m climb buried in the same wander is recovered within 10 %

`computeMetrics` / `metricsForSegments`
- altitude wander while barely moving (the standstill the OS still reports fixes
  for) reports under an eighth of the raw sum
- a real climb and descent are counted in full
- nulls still break runs; a track without elevation still reports `null`
- distance is unaffected
