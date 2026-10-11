# The live line is never slope-coloured

Reverses one behaviour introduced by `3a56be8`, on the owner's decision.

## The decision

> "The live trail should not be colored while following a trail. Or ever. The coloration only goes
> on the elevation graph, and on the trail / activity being displayed. Not on the live line."

DUP-9 described a defect: during a recording with no trail selected, the elevation graph was
slope-coloured while the live track it profiled was drawn plain, so "the map and the graph disagree
about the same route". The branch that closed it made the live track slope-coloured to match.

That reading was wrong. The recording line is not a route being analysed — it is the line showing
where you are *now*, and it carries its own colour so it reads as the live one at a glance. The
disagreement DUP-9 named is intended behaviour, not a defect.

So the colouring has exactly two homes: **the elevation graph**, and **the trail or activity overlay
being displayed**. Never the live line.

## What this keeps

DUP-9 had two halves, and only the behavioural one is reversed:

- **The port duplication is still fixed.** `TrailOverlay` and `RouteLine` were two components for one
  idea, the second a feature subset of the first. They stay merged as `RouteOverlay`; the live track
  simply uses fewer of its optional features, exactly as `RouteLine` did.
- **DUP-10's discriminator is still load-bearing**, and in fact is what expresses this rule. The
  colouring goes to the route overlay when `display.kind === route.kind` — the single tie between
  "which route the graph derived its view from" and "which overlay the map is drawing". Without it,
  `MapCanvas` would have to decide a second time what the route is, which is the defect DUP-10 named.

## Existing shape

The shape being restored is the one that shipped before `3a56be8`: `MapOverlays` takes a plain
`colouredLines?: ColouredLine[]` that only the route overlay can receive. The `{ kind, lines }`
pairing existed solely to route the colouring between two possible overlays; with one possible
overlay it is ceremony, so it goes.

## The change

`MapCanvas` computes the colouring only when it has somewhere to land:

```ts
const colouredLines = useRouteColouring(route && display?.kind === route.kind ? display : null)
```

That reads as the rule itself: colour the route on screen, when the graph's view describes it.

`MapOverlays` takes `colouredLines?: ColouredLine[]` again, passes it to the route overlay, and
passes the live overlay neither `colouredLines` nor `casing`.

The **casing on the live track goes with it.** It existed only to make the slope palette legible on a
light basemap; with no palette on the live line there is nothing to make legible, and the solid
recording colour never needed an outline. The port's `casing` comment returns to describing the route.

## What this is not

- **Not a revert of the branch.** The merged overlay component, the discriminator, the empty-runs
  guard in `routeColouring`, and its tests all stay.
- **Not a change to the graph.** The elevation graph is slope-coloured in every mode, including a
  recording with no trail. That is the point: the colouring lives there.

## A consequence worth naming

With the live track never coloured, `useRouteColouring` no longer runs during a recording with no
trail — `route` is null there, so the argument is null. The per-GPS-fix colouring cost that the last
branch measured and flagged as O(n) in track length simply stops existing in that mode. That cost
shipped as a recorded limitation, bounded to the device pass that measured it rather than guaranteed
for an arbitrarily long recording; this removes it instead of having to stand behind that guarantee.

## Testing

Pure logic is unit-tested; rendering is device-verified. Nothing here changes a pure function, so the
existing suites must pass **unchanged** at 71 suites / 586 tests, and the verification is a device
pass: the live track plain in both recording modes, the route and graph still coloured.
