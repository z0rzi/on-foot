# Draped route overlay

**Outcome (2026-11-11):** built, then items 02 and 03 reverted after the owner's device check: the
draped arrows and dots were blurry, the arrows misshapen when zoomed out. The arrows and dots are a
symbol and a circle layer again, above the live track, which D102 ([[2026-11-06-hiking-ux-design]])
accepts. Item 01, the declared order inside a tier, stays, its order since made casing, line,
connectors, arrows, endpoints: the lines, then the markers, as Mapbox draws them with terrain on.

No spec. The source was the ticket T-83 (the trail's direction arrows and endpoint dots drawn above
the recorded track, found in the device check of T-74), triaged with an Agent Brief on this plan's
branch; that triage never reached master, where the ticket is closed, so its cause and evidence are
kept here. T-78 (a line source that remounts covering its own overlay's arrows and endpoints) was
folded in. Decision behind both: D83, [[2026-11-06-hiking-ux-design]].

The cause, confirmed on the device on 2026-11-10 with two release builds of master at 97acb96 and
the same paused recording over `DEVCHECK climb`: with `Terrain` unmounted the track covers the
arrows and the start dot; with it mounted both are drawn whole on top of the track. The layers sit
where the tier anchors put them (rnmapbox inserts every layer type through the same
`addLayerBelow`); with terrain on, Mapbox drapes line layers onto the terrain and draws symbol and
circle layers afterwards, above every draped layer, whatever the style order. The plan made every
layer of a route overlay a draped one and declared the order inside a tier instead of leaving it
to mount order.

| # | Item | Delivers |
| --- | --- | --- |
| 01 | The layers of a route overlay stack in a declared order inside their tier | Casing, line, arrows, connectors, endpoints, bottom to top, whatever mounts late |
| 02 | The trail's direction arrows are draped and the live track covers them | Arrows as a draped line pattern, hidden under the track |
| 03 | The trail's endpoint dots are draped and the live track covers them | Dots as a draped rendering at constant screen size, hidden under the track |

## What the build needs beyond the ticket

- **The in-tier order extends the tier anchors**, it is not a second mechanism: the tiers are held
  by invisible anchor layers mounted first, in order, and every overlay layer is inserted below its
  anchor. The same idea one level down (a slot per kind of layer inside a tier) is the expected
  shape. The pure part is Jest-tested first, beside the existing tiers test.
- **02 and 03 are chained** although the dots only need 01: both rewrite the same adapter
  component, and T-83 can be closed by one item only, the last.
- **The dots' rendering is unproven.** No draped circle layer exists. The candidate is round-capped
  line layers over a minimal segment (a wider one beneath for the ring); whether Mapbox renders a
  near-zero-length line as a dot, at every zoom, is the first thing 03 checks on the device.
- **A line pattern is clipped to the line's width and bakes its spacing into the image**, so the
  arrow asset and the port's arrow props (`arrowSpacing`, `arrowSize`) are expected to change in 02.
  The props stay provider-neutral: MapLibre must be able to implement them.
- **Device checks** use the `device-check` skill, terrain on, recording along a `DEVCHECK` trail
  and through its start dot. A `DEVCHECK climb` trail is on the phone (2026-11-10). The look of the
  new arrows and dots is the owner's to verify, never claimed.
