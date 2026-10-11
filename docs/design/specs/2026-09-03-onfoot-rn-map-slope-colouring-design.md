# Map Trail Slope Colouring — Design

**Date:** 2026-09-03
**Status:** Draft for review (decisions flagged below)

## Problem

The elevation graph shows *how much* climbing there is, but not *where*. A hiker looking at
the map can't see which parts of the route are steep. Colouring the trail line on the map by
slope puts that information where the hiker is already looking.

This is the geographic partner to the elevation graph, and — together with the graph's
thickness/contrast channel (feature A) — gives the app slope information on two surfaces
through two channels (colour on the map, thickness+contrast on the graph).

## Feature

Draw the selected trail's / activity's route line on the map coloured by slope, reusing the
exact same slope model as the elevation graph (smoothed `slopeBands`). **Colour only — no
line-thickness variation** (thickness at map zoom is subtle and reads as messy; that channel
lives on the graph).

### Scope

- **In:** the selected **trail** line and the selected **activity** line (the saved geometry
  already drawn via the provider overlay).
- **Out (future):** the **live recording** track (its slope is noisy and constantly changing);
  keep it the plain recording colour for now.
- Segment breaks stay breaks — a coloured run never crosses a gap (same invariant as the graph).

## Decisions to confirm

1. **Always-on vs toggle.** Slope-colouring replaces the line's single identity colour
   (trail purple / activity teal) with the slope ramp. That trades the "this is a trail vs an
   activity" colour cue for slope info. Options:
   - (a) **Always-on** when a trail/activity is selected (simplest; the mode chip + map context
     still say which it is). **Recommended for v1.**
   - (b) A **toggle** (a map-layers option or a setting "Colour route by slope"), default on.
   Recommend (a) now, add (b) later if the identity-colour loss bites.
2. **Colour ramp source.** Reuse the graph's theme tokens (`slopeSteep/Rough/Uphill/Downhill`,
   and `panelBackground` for flat) so the two surfaces match. Flat on the map → the line's
   existing identity colour (trail/activity) rather than sheet colour, so flat still reads as
   "a route." (Flat = the normal line colour; slopes = the ramp.)
3. **Accessibility.** Colour-only on the map is acceptable because the *graph* already carries
   the non-colour (thickness/contrast) channel for the same data; a hiker who can't use colour
   reads slope on the graph. Documented, not ignored.

## Architecture

The map-provider seam stays inviolable. The port learns a **generic "coloured polylines"**
concept — NOT slope bands. All slope semantics stay in shared code; the adapter only draws
polylines that each carry their own colour.

### Pure core (elevation → coordinates)

New `src/elevation/mapSlope.ts`:

```ts
import { ElevationProfile } from './profile'
import { SlopeBand } from './slope'
import { GradeBand } from './profile'

export interface SlopeRun { band: GradeBand; coordinates: [number, number][] } // [lng, lat]
export function buildSlopeRuns(profile: ElevationProfile, bands: SlopeBand[]): SlopeRun[]
```

For each band, emit the `[lng, lat]` coordinates of the profile samples in that band's distance
range, with interpolated coordinates at the band's start/end so adjacent runs join seamlessly.
**Break handling (the tricky part):** runs are built per profile-segment — a run never spans a
segment break, and boundary coordinates are interpolated *within* a segment (not via a global
distance lookup, which is ambiguous at a break where two segments share a cumulative distance).
Coordinates come from the **raw** profile (accurate positions); `bands` come from the **smoothed**
profile (same as the graph) → accurate geometry, smoothed colour.

### Port (provider-agnostic)

`src/map/provider/types.ts` — add an optional field to the trail/route overlay props:

```ts
// Each polyline carries its own colour; the adapter draws them with a data-driven line colour.
colouredLines?: { coordinates: [number, number][]; color: string }[]
```

When present, the adapter renders these **instead of** the single-colour line (endpoints/arrows
unchanged). The port never sees `GradeBand` — shared code maps band → theme colour first.

### Adapter (Mapbox only)

`src/map/providers/mapbox/adapter.tsx` — when `colouredLines` is set, build a `FeatureCollection`
of `LineString` features each with a `color` property, and one `LineLayer` with
`lineColor: ['get', 'color']` (data-driven from each feature's own colour). One layer, no
per-colour layer explosion. `lineMetrics` not needed (we split into features, not a gradient).

### Shared wiring

`src/map/MapOverlays.tsx` — for the route being drawn, build the profile (`buildElevationProfile`)
+ smoothed `slopeBands` (reuse the `elevationSmoothingMeters` preference for consistency with the
graph) + `buildSlopeRuns`, map each run's `band` → theme colour (flat → the route's identity
colour), and pass `colouredLines` to the overlay. No elevation data → omit `colouredLines`
(falls back to the plain identity-colour line).

## Testing

- **TDD:** `buildSlopeRuns` — one run per band with correct coordinates; **a two-segment profile
  produces runs that never cross the break** (the key correctness test); no-elevation → empty;
  adjacent runs share their boundary coordinate.
- **Device-verified:** the data-driven `LineLayer` colouring, on-map legibility over satellite
  vs terrain, and that breaks render uncoloured/plain.

## Out of scope / future

- Live recording track colouring.
- A toggle (decision 1b) if always-on proves to lose too much identity-colour cue.
- Thickness on the map (explicitly rejected — subtle + messy at map scale).
