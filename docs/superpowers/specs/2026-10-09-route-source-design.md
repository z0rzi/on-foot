# One decision about which route is on screen, and one way to draw it

Closes **DUP-10** and **DUP-9**, in that order, because the first is what makes the second honest.

## The two findings, and why they are one change

**DUP-10** — "which route is on screen" is decided twice: `profileSegmentsFor` picks the segments the
elevation view is derived from, and `trailToShow` plus the `activity` prop pick what `MapCanvas`
actually draws. Two independent mode-by-mode decisions, kept in agreement only by both being right.

**DUP-9** — the port has two route-line components. `TrailOverlayProps` carries `colouredLines`;
`RouteLineProps` does not, and the Mapbox adapter implements the data-driven colour path once, in
`TrailOverlay`. `RouteLine` is a feature subset of it. The visible consequence: recording with no
trail selected, the graph is slope-coloured but the live track it profiles is drawn plain — the map
and the graph disagree about the same route.

They are one change because fixing DUP-9 forces the question DUP-10 answers. Once the live track
*can* be coloured, something must decide **which** overlay the colouring belongs to — the trail or
the live track — and during a recording with a followed trail both are on screen at once. Without a
discriminator that decision would be re-derived in `MapCanvas`, making it the *third* place that
decides what the route is. So the discriminator lands first, and the colouring reads from it.

## Existing shape

- **The discriminator** follows `OverlayRoute` (`src/map/MapOverlays.tsx:12`), which already carries
  `kind: 'trail' | 'activity'` for exactly this purpose — telling the renderer what it is drawing.
  This change extends that idea one step back, to the value the elevation view is derived from, and
  adds the third case `'live'`. Nothing new is invented; the existing tag gains a sibling.
- **The merged overlay** has its first instance in `TrailOverlay` itself, which is already the
  general component: casing, optional arrows, optional data-driven colour, connectors, endpoints.
  `RouteLine` is that component minus four features. The merge deletes the subset rather than
  extracting a shared helper between two near-copies — AGENTS.md's "the second instance of a shape is
  the moment duplication is born" points at collapsing them, and the finding itself calls `RouteLine`
  "a feature subset".
- Nothing is extracted to be shared beyond that, because after the merge there is only one thing.

## DUP-10 — the source discriminator

```ts
export type RouteSource = 'trail' | 'activity' | 'live'

export interface RouteDisplay {
  kind: RouteSource
  profile: ElevationProfile
  smoothed: ElevationProfile
  bands: SlopeBand[]
}
```

`profileSegmentsFor` becomes `profileSourceFor`, returning `{ kind, segments } | null`. The mode
branches are unchanged; each now also names what it chose.

`MapOverlays` then routes the colouring to the overlay that matches, through a single value:

```ts
colouring?: { kind: RouteSource; lines: ColouredLine[] }
```

The route overlay is coloured when `colouring.kind === routeKind`, the live overlay when
`colouring.kind === 'live'`. One decision, read from the same value the profile came from.

### The trap: this must not reintroduce PERF-2

`useRouteDisplay` memoises in two stages *on purpose*. The first keys on
`[mode, trail, activity, livePoints]` and therefore re-runs on **every GPS fix**; the second keys on
the segments array, which in recording-with-a-trail is `trail.geometry.segments` — the same
reference every time — so the profile and banding pass does **not** re-run per fix. That split is
the fix for the regression caught on the route-display branch (`0e0b7d7`).

Returning a fresh `{ kind, segments }` object from the first memo would change identity on every fix
and re-run the second, **restoring the regression**. So the second memo must key on the parts, not
the object:

```ts
const source = useMemo(() => profileSourceFor(mode, trail, activity, livePoints), [...])
const kind = source?.kind ?? null
const segments = source?.segments ?? null
return useMemo(
  () => (kind && segments ? routeDisplay(kind, segments, smoothing) : null),
  [kind, segments, smoothing],
)
```

`kind` is a string and `segments` keeps its identity, so the second memo holds exactly as it does
today. A unit test pins the identity half; the device check pins the behaviour.

## DUP-9 — one overlay component

`TrailOverlayProps` and `RouteLineProps` collapse into `RouteOverlayProps`:

```ts
export interface RouteOverlayProps {
  // Layer-id prefix, so two overlays coexist on one map.
  idPrefix: string
  lines: [number, number][][]
  connectors: [number, number][][]
  connectorDashArray: number[]
  color: string
  lineWidth: number
  colouredLines?: ColouredLine[]
  casing?: boolean
  arrowImage?: number
  arrowSpacing?: number
  arrowSize?: number
  endpoints?: {
    points: [number, number][]
    radius: number
    strokeColor: string
    strokeWidth: number
  }
}
```

Two deliberate choices:

- **`idPrefix` is passed as `'trail'` and `'route'`** — the prefixes those two components already
  use. Every Mapbox layer id in the app therefore stays byte-identical, so nothing that references a
  layer id can break, and the merge is invisible to the SDK.
- **Endpoints are one optional object**, not four optional props. Grouped, the feature cannot be
  half-configured; separate, `endpoints` without `endpointRadius` would compile.

`casing` is a semantic flag, not a Mapbox concept: "draw an outline under the line". The route
overlay always passes it; the live track passes it only when it is slope-coloured.

## What changes on screen

**One thing:** recording with no trail selected, the live track is slope-coloured instead of plain,
so it agrees with the graph above it. That is the defect DUP-9 describes.

Everything else is intended to be pixel-identical: the trail and activity overlays keep their casing,
arrows, endpoints and colours; the live track keeps `recordingLine` as its colour whenever it is not
the display source or has no elevation; layer ids and z-order are unchanged.

**One more change, added once the first build was on a device:** the live track also gains a casing
whenever it is slope-coloured. Without one, the palette's near-white flat band was indistinguishable
from the light basemap, so the casing the route already had turned out to be load-bearing for the
live track too.

## Deliberately not done

**Colouring the live track while a trail is being followed.** The finding defers this explicitly, and
for a real reason: with a trail followed, the display is derived from the *trail*, so colouring the
live track would need a second profile derived from the live points — a second owner of the derived
state that item 7 existed to collapse. It stays a plain `recordingLine` line, as today, and that is
the owner's call to revisit.

## Testing

Pure logic is unit-tested; rendering is device-verified, per AGENTS.md.

- `profileSourceFor` — the existing seven cases port over, each now also asserting `kind`, plus the
  identity assertion that recording-with-a-trail returns `trail.geometry.segments` **by reference**
  (the PERF-2 guard).
- `routeDisplay` — carries `kind` through unchanged.
- Rendering, z-order, and the per-fix memo behaviour are device checks, listed in the plan.

## Out of scope

- No change to `trailToShow`, to `mapMode`, or to which entity is selected.
- No change to the slope palette, the band maths, or the smoothing preference.
- No new capability flag and no seam change: this is all inside `src/map`, and the SDK stays confined
  to `src/map/providers/`.
