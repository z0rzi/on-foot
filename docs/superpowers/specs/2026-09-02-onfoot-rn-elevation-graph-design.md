# Elevation Graph — Design

**Date:** 2026-09-02
**Status:** Approved for planning

## Problem

Trails and activities carry per-point elevation, but nothing visualises it. A hiker
wants to see the climb profile at a glance — where the steep bits are, how much is
left — and to inspect any point along the route.

## Feature

A floating elevation-profile strip shown above the info sheet, for trails, activities,
and while recording. The area under the curve is coloured by slope. The user scrubs a
finger across it to inspect any point, which drops a synced marker on the map.

### Scope (this feature)

- Static, scrubable elevation profile.
- Appears for: a selected **trail**, a selected **activity**, and while **recording**
  (profile of the followed trail if any, otherwise the live activity).
- Momentary scrub: cursor + map marker exist only while the finger is down; both vanish
  on release.
- Slope-coloured fill under the curve.

### Out of scope (documented follow-up)

- A live "you are here" indicator projecting current position onto the profile. This is
  a stateful map-matching problem with enough edge cases to warrant its own
  brainstorm → spec → TDD cycle. Design captured in **Future Work** below so the
  groundwork here (profile keyed by cumulative distance) slots in cleanly later.

## Interaction

- **Momentary scrubber.** A pan gesture over the strip. While touching: an in-graph
  vertical cursor + tooltip (`elevation · distance · grade`, e.g. `1240 m · 3.2 km · +8%`)
  and a marker on the map at that point's lat/lng. On release, both disappear. No
  lingering state, no dismiss affordance.
- The graph **floats above** the sheet rather than living inside it, so its gesture never
  fights the bottom-sheet drag.

## Slope colour bands

Grade = rise ÷ run as a percent. Downhill is a single green regardless of steepness.

| Grade %       | Band             | Colour       |
|---------------|------------------|--------------|
| > +25         | impossibly steep | black        |
| +12 … +25     | rough uphill     | red          |
| +4 … +12      | uphill           | orange       |
| -4 … +4       | flatish          | none (empty) |
| < -4          | downhill         | green        |

Flat renders as empty (no fill). Colours live in theme tokens
(`slopeSteep / slopeRough / slopeUphill / slopeDownhill`), theme-aware, never hard-coded —
same discipline as the existing line colours.

## Architecture

### Section 1 — Pure core (TDD, no React, no map SDK)

A new pure module turns geometry into a drawable, colourable profile. Works identically
for `Trail` (`GpxPoint[][]`) and `Activity` (`TrackPoint[][]`) since both are
`{lat, lng, ele}[][]`.

- **`buildElevationProfile(segments)`** → walks each segment accumulating cumulative
  distance (reusing `haversineMeters`), producing an ordered list of `{ distance, ele, lat, lng }`
  samples plus segment-break markers. Returns `null` if no point has elevation.
  This is the single source the graph renders from.
- **`gradeBand(grade)`** → maps a grade % to `steep | rough | uphill | flat | downhill`
  using the thresholds above (>25 / 12 / 4 / -4).
- **`sampleAt(profile, distance)`** → for scrubbing: interpolate `{ ele, grade, lat, lng }`
  at an x-distance, so the cursor tooltip and the map marker read from one function.
- **Colour binning** (fixed-width, not fixed-count): bin the profile into spans of
  roughly constant **width in metres** (target ~2–4px on screen, which self-limits the
  count to ~100–200 and guarantees no sub-pixel slivers). Colour each span by the **max**
  grade in the bin — max, not mean, so a short steep wall (the safety-relevant black band)
  is never averaged away. Detail scales with hike length because bin width is in metres,
  not a fixed division count. Computed in the pure module against a normalised 0–1 width,
  resolved to px at render, keeping the renderer a dumb painter.

Binning by width (not by a fixed count of points) and colouring by max grade are
deliberate: fixed-count would wash out a 100 km hike and over-noise a 500 m stroll, and
mean grade would hide the steep bits. The elevation **line** stays on the true samples
(peaks look like peaks); only the colour fill is binned.

### Section 2 — Rendering (react-native-svg; no new dependency)

`<ElevationGraph>`, pure presentational, driven entirely by the Section-1 profile:

- **Slope fill.** Each colour bin fills the area beneath its sub-span with its band colour
  (black/red/orange uphill, green downhill, nothing for flat). The elevation line is a
  thin stroke on top.
- **Y-axis** auto-fits min→max elevation with small padding; faint max/min elevation
  labels are the only chrome. A glanceable strip (~110px tall, full width), not a full
  chart.
- **Segment breaks** render as a gap (no fill, no line across), consistent with the dotted
  map connector and with metrics excluding the gap.

### Section 3 — Interaction & the map marker

- A **`Pan` gesture** (gesture-handler) over the strip.
- On touch/move → x → distance → `sampleAt` → drives (a) the in-graph cursor line +
  tooltip and (b) a marker on the map at the sampled lat/lng. On release both vanish.
- **Perf.** The in-graph cursor rides a reanimated shared value (UI thread, no
  re-render). The map marker is the one thing that must cross into React/native, so a
  tiny `useScrubStore` holds `scrubPoint | null`; only the marker layer subscribes.
- **Provider seam.** The marker must not introduce a new Mapbox import. Add a semantic
  **scrub-marker** to the provider port (`src/map/provider/types.ts`); render it only
  inside `providers/mapbox/adapter.tsx`, exactly like the existing endpoints/overlays.
  Shared code stays provider-agnostic. (Seam is inviolable per AGENTS.md.)

### Section 4 — Wiring (where it appears)

The graph floats above each info sheet, riding the sheet's live top edge via the existing
`sheetTop` / `controlsAnimatedBottom` mechanism in `MapScreen` — the same
continuous-follow pattern the controls already use — so it stays glued just above the
sheet as it snaps/drags. One shared component, four cases:

- **Trail selected** → profile of `trail.geometry.segments`.
- **Activity selected** → profile of `activity.geometry.segments`.
- **Recording, following a trail** → profile of the followed trail (already in `MapScreen`
  scope as `trail`).
- **Recording, no trail** → profile of the live activity
  (`groupPointsBySegment(livePoints)`) — you watch your own climb build.
- **No elevation data** → `buildElevationProfile` returns `null` → graph absent (no empty
  box).

### Section 5 — Testing

- **TDD (Jest):** `buildElevationProfile` (accumulation, null-when-no-elevation, segment
  breaks), `gradeBand` (boundary values), colour binning (fixed-width spans, max-grade,
  no sub-pixel), `sampleAt` (interpolation + endpoints). All pure.
- **Device-verified:** SVG rendering, pan-scrub feel, marker sync, float-above-sheet
  behaviour — per the codebase rule that rendering/gestures are device-checked.

## Future Work — live position indicator (deferred)

A dot on the profile showing the hiker's current position along a followed trail. Deferred
because it is a stateful matcher, not a rendering job, and deserves its own cycle. The
design below is the agreed starting point.

### Compute on-view, not live

Do **not** match fix-by-fix as GPS arrives. While the phone is pocketed/locked nobody is
watching the graph — computing then wastes battery and accumulates error. Instead compute
**only when the map is on screen** (unlock / foreground / open sheet). At that moment the
**entire recorded track** is available, so this is *offline* map-matching (strictly easier
and more reliable than online) — replay the trajectory once rather than tracking it.

### The rule (one uniform pass — KISS)

```
s = null                               # arc-length along the trail, metres
for each recorded point p, in time order:
    candidates = trail points within R metres of p
    if none:            continue                          # off-trail here; s unchanged
    else if s is null:  s = nearest candidate's arc-length   # cold start
    else:               s = candidate whose arc-length is closest to s   # continuity tiebreak
# dot = s ; if the LAST recorded point had no candidates → show nothing (off-trail now)
```

One rule, no state machine, no confidence ladder, no heading heuristics. Pure and
TDD-able. Runs once per view (a linear pass over a few thousand points is negligible).

### Why this is reliable-first (vs the AllTrails failure)

Because it replays the full trajectory with forward continuity, the **common case (a normal
trail) is always resolved and always shown**. The dot hides only when hiding is *correct* —
the latest position is genuinely off-trail. That is the opposite of "usually no indicator,
occasionally magic."

### Radius

R must absorb GPS error (routinely 5–10 m, worse under canopy). A hard 10 m would flicker
the dot out while genuinely on-trail — the very failure to avoid. Default **R ≈ 20–30 m**,
tunable. Larger radius costs nothing in the common case and only slightly loosens overlap
disambiguation.

### The continuity-tiebreak decision (unresolved — decide via tests)

At a real self-overlap, "continue vs double back" cannot be resolved from a single
position; it needs direction of travel, which the dense replay carries (previous point).
Three candidate tiebreaks, to be chosen by running the scenarios as tests:

1. **Symmetric "closest to `s`"** (provisional default). Because the track is dense
   (points a few metres apart), `s` moves only a little per step, so "closest to `s`" *is*
   direction-following for free: forward → `s` rises; turn around → `s` falls. Honors
   "go back when I go back" with no extra rule. Unambiguous for a normal out-and-back
   stored as a single A→B line (one candidate per spot).
2. **Forward-biased** (prefer candidate after `s`, else before). Rejected as default: with
   a dense track the just-passed forward points stay within R after you turn around, so the
   dot sticks forward and lags every reversal — breaks "see it go back when I go back."
3. **Forbid-back** (going back → off-road → reacquire → snap to earlier stage). Rejected:
   guarantees a flicker on every backtrack and re-introduces the off-road/reacquire state
   machine that KISS removed.

If the overlap case ever needs hardening, the disambiguator is the **trend of `s` over the
last few points** (direction), not a forward/back bias.

### Scenario test suite (all handled by the one rule unless noted)

- **Out-and-back** — `s` climbs then descends the same curve (symmetric tiebreak).
- **Shared-path loop** — start (`s≈0`) and finish (`s≈total`) are far apart in arc-length,
  so the window keeps them distinct though same on the ground.
- **Leave and rejoin elsewhere** — off-trail points don't advance `s`; on rejoin the near
  candidates set `s` to the new location.
- **GPS glitch (jump 500 m and back)** — a physically impossible step; `s` only advances on
  matched on-trail points, so the phantom distance is never integrated. (A speed/plausibility
  pre-filter also discards it.)
- **Same-direction overlap rejoin** — heading can't disambiguate; if two candidates remain
  plausible and branches run parallel, show nothing until they diverge.
- **Cold-start on an overlap** — replaying from the start of the recording means `s` is
  well-established by the time "now" is reached, so the crossing is disambiguated by the
  path already walked.
- **Figure-8** — at the crossing both loops have candidates, but the physically-walked
  loop's continuation is at `s + ε`, so `s` stays on it. Following only one loop: `s` stays
  in that loop's arc-length range; a bad cold-start guess self-corrects at the first
  unambiguous (single-candidate) point.
- **Backwards** — the symmetric tiebreak has no forward bias, so `s` decreases and the dot
  slides back down the profile.

### Known residual (document, don't engineer around)

A deliberate big **shortcut that skips far ahead** and rejoins: "closest to last `s`" is
biased toward where you left (behind you), so the dot can sit behind or stall until the
geometry is unambiguous. Rare, predictable, self-corrects on a normal trail. Small detours
(step off, rejoin nearby — the common off-trail case) are handled perfectly.

---

## Revision 2026-09-02 — device feedback: colour pipeline redesign, transparency, Y-axis

On-device the first cut showed a "barcode" of black/red/orange stripes even on a gentle
8.3 km / 528 m hike, with orange inside descents. Root cause: **GPS elevation noise**
amplified by two original choices — colouring each pixel-bin by its **MAX** grade, and
computing grade over raw consecutive samples. A 5 m noise blip over 20 m reads as a 25%
grade (black); MAX makes one noisy pair paint a whole bin; a single up-blip inside a
descent makes that bin orange. This revision **replaces the colour pipeline** (not a
patch) and addresses three feedback points.

### Decisions (from the user)

1. **Flat sections:** truly no fill (transparent through to the map). Not a neutral fill.
2. **Smoothing window:** default **50 m**, and **user-configurable in the Settings tab**.
3. **Elevation line:** stays **accurate** (raw) — a short steep step is real information the
   hiker should see. Only the *colours/grades* are smoothed.

### Redesigned colour pipeline (clean, intentional)

Two representations, deliberately separate:

- **Accurate profile** (`buildElevationProfile`, unchanged): raw samples with cumulative,
  gap-excluded distance. Drives the **line** and the scrub tooltip's **elevation**.
- **Smoothed slope** (new `slope.ts`, replacing `bins.ts`): the terrain's *steepness
  character*, computed for colouring only.

The old `bins.ts` (fixed-width pixel bins + max-grade) is **deleted**. The new pipeline:

1. `smoothProfile(profile, windowMeters)` — moving average of elevation over a **distance**
   window (default 50 m), computed **per segment** (never across a break). `windowMeters ≤ 0`
   → identity (smoothing "Off"). Returns a new `ElevationProfile` (smoothed eles, same
   distances/segments, recomputed min/max).
2. `slopeBands(smoothed, minRunMeters)` — grade per consecutive **smoothed** same-segment
   pair → `gradeBand` → coalesced contiguous **runs in distance space**; runs shorter than
   `minRunMeters` (the graph passes the smoothing window) dissolve into their longer
   neighbour and recoalesce. Output `SlopeBand[] = { start, end, band }[]`.
3. Colour is the band's own (smoothed) grade — **no MAX, no pixel bins**. Bands are semantic
   constant-slope runs, independent of pixel width, so the barcode cannot recur. A descent
   with a small bump smooths to net downhill → green; black/red appear only for genuinely
   steep runs sustained over ≥ the window.

`buildBandAreas` is retargeted from `ColorBin[]` to `SlopeBand[]` (identical shape) and still
fills **under the accurate line** — accurate silhouette, smoothed colour. The scrub
tooltip's **grade** comes from the smoothed profile (`sampleAt(smoothed, d).grade`) so the
number under the finger matches the colour there; its **elevation** stays from the raw line.

### Transparency

The graph container drops its opaque panel background — it floats over the map. Flat
sections (no fill) reveal the map beneath the line (decision 1). To stay legible over the
varied map, the **line** is drawn with a thin dark halo (a wider translucent stroke beneath
the coloured stroke) and **axis labels** use an SVG text halo (stroke).

### Y-axis

Replaces the single "min–max" corner label with `buildAxisTicks(profile, height, targetCount)`
→ nice round elevations (1/2/5·10ⁿ step) within `[minEle, maxEle]`, each with its `y`. Rendered
as faint full-width gridlines with left-gutter labels, so elevation values are always visible.
The scrub tooltip (elevation · distance · grade) still appears while scrubbing.

### Settings

`preferencesStore` gains `elevationSmoothingMeters` (default 50, persisted) + a setter, and the
Settings tab gets a smoothing control (preset chips: Off / 25 / 50 / 100 / 200 m). The metrics
tiles (e.g. "528 m gain") stay computed from raw data and are intentionally left unchanged.

