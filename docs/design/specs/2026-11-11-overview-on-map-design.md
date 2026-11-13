# Overview on the map: every trail and activity at once, tappable, with pins — Design

**Status:** Built, [[2026-11-11-overview-on-map]]. From the owner's grilling of 2026-11-11, challenged twice the same
day (each time a fact-check and a design critique) with three device spikes, and revised with the
owner's rulings and a UX session on the pin and the data path. Extends the map of the hiking-ux spec
(§4.1, §4.5) as D103–D139; decision numbers continue that spec's (D129 and D137 are unused). D139
is the owner's ruling of 2026-11-12, from a first look at the build. Revises the layer quick-switch
spec's "choosing a layer closes the sheet" (D130).
**From:** [[T-26-all-activities-on-map]]; [[2026-11-06-hiking-ux-design]] (§4.1 "Map", §4.5 "Map
card", §4.7 "Selecting a trail while recording", D83/D102 for the stacking);
[[2026-08-20-onfoot-rn-layer-quick-switch-and-tap-outside]] (the Layers menu it restyles).
**Date:** 2026-11-11

Terms are the glossary's: **Overview**, **Family**, **Completed**, **Pin**, **Cluster**, **Layer**,
**Card**, **Pill**, **Nav row**, **Follow**. "Selected" is the trail or activity the card and pill
are about.

## Problem Statement

The map shows one thing at a time: the selected trail or activity, or nothing. To see where the
owner has walked, or which trail starts near the one on screen, they go through the lists, pick one,
come back, and lose the previous one. The map is never a picture of everything they have.

While hiking it is the same: the trail followed is drawn alone, and a known trail crossing it is
invisible.

## Solution

The map draws the **overview**: every saved trail and activity as a thin plain line, each with a
**pin** at its start. The owner taps a line or a pin to select it; the card opens as it does from a
list, and a tap on the bare map closes it. What is selected keeps today's full dress, with its
**family** drawn slim around it: a trail and all the activities linked to it, so the owner sees
where each walk strayed. Everything else dims.

While recording, the overview stays, dimmed and without pins, as landmarks. A tap on one of its
lines names it in a toast and changes nothing.

The Layers menu becomes two rows of tiles: the map layers (one chosen), and what the overview shows
(trails, activities, each on or off, remembered).

Nothing the owner does on the map stalls it. Panning and zooming involve no app code; a selection or
a toggle restyles the lines and rebuilds only the small list of pins; saving, importing or deleting
a trail or an activity rebuilds the lines, in the background.

### What the map draws, by state

| State | Selected item | Its family | Rest of the overview | Pins | Tap on the overview |
|---|---|---|---|---|---|
| Idle, nothing selected | none | none | full strength | shown | selects |
| Idle, something selected | full dress (bold, slope colours, as today), no pin | slim, plain, full strength, under the selected route | dimmed | the family's first, others dimmed | selects (switches); a tap on nothing deselects |
| Recording or paused | followed trail if any (as today) + live track | not drawn | dimmed | none | toast naming the item |

### What the overview holds

- Trails on, Activities on: every trail, and every activity not linked to a trail. A linked
  activity is left out: its trail's completed pin stands for it, and says how many (`✓3`).
- Trails on, Activities off: every trail.
- Trails off, Activities on: every activity, linked or not, each with its own pin.
- Both off: nothing. The map is bare, clusters included.
- The selected item and its family are drawn whatever the toggles say, and are never drawn twice.

### Pins

```
  ⬤╭──────────╮       ⬤╭─────────────────╮       ⬤╭─────────╮
  ▼│ 5.1 km   │       ▼│ ✓3 · 12.4 km    │       ▼│ 11 km   │         ⬤ 6
   ╰──────────╯        ╰─────────────────╯        ╰─────────╯
  ↑ start point (the tip)
 trail: trail colour,   completed: split, trail     activity: activity      cluster: dark
 white centre           colour left, activity       colour                  disc, white
                        colour right (Activities                            border, count
                        off: all trail colour);
                        the tag counts the
                        linked activities
```

The pin is a teardrop: its tip is on the start point, its round head above it, with a white border
and a soft shadow, so it reads at once as "this exact spot", and the trail's line leaves from the
tip. The tag is a white pill with a soft shadow beside the head, vertically centred on it and
tucked under it, holding the distance. The teardrop's colours and centre carry the kind and the
state; there is no glyph in the head. A trail not yet completed has a white centre. A completed
trail has none: with Activities shown it is split down through its tip, the left half in the trail
colour and the right half, beside the tag, in the activity colour, so the activity colour marks
every place the owner has walked; with Activities off it is all trail colour. Where tags would
collide they give way, the teardrops stay, and a bare teardrop still reads as a whole pin. The tags kept first are the selected family's,
then trails not yet completed, then completed trails, then activities. Pins too close to tell apart
merge into a **cluster**.

## User Stories

1. As a hiker browsing the map, I want all my trails and activities drawn at once, so that I see
   where I have been and what I have to walk.
2. As a hiker zoomed far out, I want pins and clusters instead of unreadable specks of line, so
   that the map stays legible.
3. As a hiker, I want to tap a line or a pin and get its card, so that I do not go through a list.
4. As a hiker with a trail selected, I want its past activities drawn with it and listed in its
   card, so that I see how each went and open any of them.
5. As a hiker with an activity selected, I want its trail and sibling activities still drawn, and
   the siblings listed in its card, so that I switch between them without going back to the trail.
6. As a hiker, I want to tell at a glance which trails I have completed and how often, so that I
   pick a new one.
7. As a hiker recording, I want the other trails still visible but subdued, so that I recognise a
   junction without losing the trail I follow.
8. As a hiker recording, I want a tap on another trail to tell me its name, so that I know which
   one crosses mine, and I want that tap to change nothing.
9. As a hiker, I want to choose whether the overview holds trails, activities, both or neither,
   and have that remembered.
10. As a hiker, I want the Layers menu to show each layer as a preview with its name under it.
11. As a hiker facing several pins on the same spot, I want to pick among them by name.
12. As a hiker with something selected, I want a tap on the bare map to close its card, so that I
    get back to the whole overview without reaching for the close button.

## Implementation Decisions

### Behaviour (owner, 2026-11-11)

- **D103, the overview.** Trails and activities are drawn all at once whenever the map is shown,
  recording included. Default: both kinds on.
- **D104, the linked-activity rule.** With trails shown, an activity linked to a trail is not in
  the overview; the trail's tag counts them (D116). Accepted consequences: a trail walked three
  times is one line and one pin reading `✓3`; a linked activity that strayed far from its trail is
  hidden too; with both toggles on, "Activities" in practice means the ones tied to no trail. With
  trails hidden, every activity is shown with its own pin.
- **D105, completed.** A trail is completed when at least one saved activity is linked to it,
  whatever that activity covered. Derived, with the count, never stored. A coverage rule is out of
  scope.
- **D106, overview look.** Thin plain line: no casing, no arrows, no slope colours, no endpoint
  dots. Trails in `trailLine`, activities in `activityLine`, the theme's colours. Today those show
  on a route without elevation and on connectors and endpoint dots, never as thin lines among
  others: the hues are tuned on device (Verification 3). The family's lines are as thin as the
  rest; "slim" means plain and undimmed, set apart from the bold selected route.
- **D107, lines by zoom.** Far out, pins and clusters only; lines fade in over a short zoom range
  from a threshold, one for every item, a constant in `MapTokens`. The fade is an opacity that
  depends on the zoom only, and the line layers' minimum zoom sits at the bottom of the range, so
  below it lines are neither laid out nor tappable (spike: a line faded out by zoom, or under its
  layer's minimum zoom, is not reported by a press).
- **D108, focus dims the rest.** When something is selected or a recording is on, the overview
  outside the family dims, its pins with it. One rule for both cases.
- **D109, the family.** Selecting a trail, or an activity linked to one, draws the trail and every
  activity linked to it. The selected member is in full dress; the others are slim and plain, at
  full strength, tappable. Independent of the toggles. An activity with no linked trail has no
  family: it is drawn alone.
- **D110, draw it all.** Family lines are drawn whole. Nothing computes where one lies on another;
  where they coincide, the upper one shows.
- **D111, one selection.** The model stays one selection, trail or activity. Tapping a family
  member makes it the selection; closing the card clears it. No back-stack. The activity card keeps
  "View linked trail".
- **D112, what a tap picks.** Pins win over lines. Several pins under the finger: the list of
  D118. Among lines: the nearest to the finger; at equal distance a trail over an activity; never
  the selected item, so a tap on the selected route's own line falls through to what lies under
  it, and keeps the selection if nothing does (D139). No cycling through stacked lines: siblings
  are reached through the card's list (D115).
- **D113, no camera move on a map tap.** Selecting from the map leaves the camera, the pitch and
  the follow mode as they are. A selection from a list keeps its fit. With follow on, the camera
  still shifts when the card opens, because the follow padding follows the card: accepted. A
  tapped item may end under the card: accepted.
- **D139, a tap on nothing deselects (owner, 2026-11-12).** Idle with something selected, a tap
  that hits no pin, no cluster and no overview line clears the selection, as closing the card does,
  and moves no camera (D113). A tap on the selected route keeps it. The selected item's own line
  leaves the overview once its route has loaded (D132) and the press reads no route layer, so
  "nothing hit" does not tell "off the route": press resolution measures the press against the
  selected item's overview geometry, and a press within the press tolerance (its dp at the press's
  zoom) plus the overview geometry's own tolerance is on the route. While the selected route's
  place is unknown (no readable overview geometry), a tap on nothing keeps the selection.
  Recording or paused, a tap never deselects: the selection is the followed trail. A press whose
  query fails (D126) does nothing.
- **D114, recording.** Recording or paused: no pins and no clusters, the overview is dimmed, the
  followed trail's family is not drawn. A tap on an overview line shows the existing toast with
  "<name> · <distance>" and selects nothing. A tap on the same item within a few seconds shows
  nothing more: Android queues toasts, and wet or repeated taps must not stack them ahead of the
  recording's own ("Hold to pause"). The Trails and Activities lists keep today's rules (§4.7:
  switching trail asks first; opening an activity is refused).
- **D115, the family list in the card.** Under a "Completed N×" heading, the family's activities,
  most recent first, each row with its date and duration; a row selects that activity. On the
  trail card, and on a linked activity's card, where the selected activity's row is marked as the
  one shown. Absent when the trail has no activity; not on the recording card.
- **D116, pins (owner, from a device gallery of four anchor shapes).** As drawn in the Solution: a
  teardrop whose tip is on the start point, about 22 dp tall with a head about 16 dp across, a
  white border of about 1.5 dp and a soft shadow; the tag, a white pill about 16 dp tall with a
  soft shadow and text at 11, beside the head, vertically centred on it and starting under its
  centre. Trail: trail colour with a white centre. Completed trail: no centre and no check, the tag
  reading `✓<count> · <distance>`; with Activities on, the teardrop is split down through its tip,
  the left half trail colour and the right half, beside the tag, activity colour; with Activities
  off, it is all trail colour (owner, 2026-11-12: "respect the colour codes", the activity colour is
  what the owner scans for to find where they have walked, and a trail-coloured pin with a check
  did not read as "there is an activity here"). Clusters carry no activity mark: to see where they
  have walked, the owner turns Trails off. Activity: activity colour. With trails shown,
  one pin per family, the trail's. The selected item has no pin: its start is the route's endpoint
  dot, where the tip was. The size sits between the gallery's rows B and C (the first drawn pins
  were too big). Future picture pins (T-27) keep the round head with a white border and a shadow,
  holding the picture.
- **D136, tags give way, teardrops stay.** Where tags collide, the map hides some; the teardrops
  always stay, and a tag never runs under another pin's teardrop: each teardrop reserves its place
  against tags (spike: a disc drawn as a circle did not, and a tag slid under its neighbour's).
  Tags are kept in this order: the selected family's, trails not completed, completed trails,
  activities.
- **D117, clusters.** Pins that would overlap merge into a dark disc with a white border and a
  count, trails and activities counted together, dimmed with the rest. A cluster holds only pins
  that are shown: a pin hidden by a toggle, the selection or a recording is not counted. Past the
  cluster cap a cluster stays a cluster at every zoom, so two pins never sit on one pixel. The cap
  (around zoom 17) and the cluster radius are chosen together so that only starts within about
  15–20 m stay merged for good; both are `MapTokens` constants tuned on device. A cluster's count
  is always drawn and never pushes a tag away.
- **D118, tapping a cluster.** Below the cap, the map fits the starts it holds, never zooming past
  the cap; follow ends, as with any one-shot camera move. At the cap or past it, below it on a
  cluster whose starts stay merged at the cap, or when several pins lie under the finger, a modal
  lists the items (name, distance, completed count); a row selects that item. The camera never
  zooms in to tell apart two starts a few metres apart.
- **D119, the Layers menu.** Two rows of tiles, a preview with its title under it. "Map": the
  layers, one chosen. "Show on map": Trails and Activities, each on or off like a checkbox, both
  off allowed. The choice is remembered across launches.
- **D130, the Layers menu stays open.** Choosing a layer or flipping a toggle applies at once on the
  map behind and does not close the menu, for both rows; it closes by its backdrop, a swipe or back.
  This revises the layer quick-switch spec, whose text is updated when this lands. Its height
  follows its content. The layer tiles are radios and the toggles checkboxes for accessibility,
  each labelled. The swipe quick-switch on the layers button is unchanged.

### Data

- **D120, a lighter geometry, stored as GeoJSON text.** Each trail and activity stores an
  **overview geometry** beside its full one: the track simplified to a tolerance in metres (a
  constant, about 10 m), positions only, rounded to 5 decimals, segments kept apart, stored as the
  text of a GeoJSON `MultiLineString` geometry, ready to be placed in a file as is. Its start point,
  the first position of its first non-empty segment, is stored beside it as two numbers, so pins
  and cluster fits never parse a geometry; taken from the simplified geometry, the pin sits on the
  line. Both are computed inside the two functions that build a row's stored values
  (`inputToInsertValues` for a trail, `inputToActivityValues` for an activity), the only two
  writers of a geometry, so a future writer that goes through them cannot forget it. The overview
  never reads or parses a full geometry. The simplification is a pure function, test-first, and the
  only producer of the overview geometry type. GeoJSON is a neutral standard, read by both
  providers; the stored format is a commitment, changed only by a migration that nulls the column
  (D121). On the owner's data (15 trails, 19 activities, 2026-11-11), 30 000 points become 2 900 at
  10 m; the largest item is 241 points, 5 KB; all of it is 56 KB.
- **D121, backfill.** Rows saved before this have no overview geometry. One pass fills the rows
  where it is null, one row at a time with a yield to the frame between rows, rebuilding the
  overview after each few rows. It starts after the migrations when no recording session exists,
  otherwise when the session ends (it subscribes to the recording phase); interrupted, it resumes at
  the next start. A row whose geometry cannot be read is stored with an empty overview geometry,
  so it is not retried, and logged. The pass logs its slowest row. Measured on the owner's data:
  reading, parsing and simplifying everything took 314 ms in all. Changing the tolerance later
  ships a migration that nulls the column.
- **D122, the existing stores own the rows.** The trails and activities stores keep **overview
  rows**: the summary extended (as `Trail` extends `TrailSummary`) with the overview geometry text
  and start point, and for an activity its linked trail, start time and duration. They are loaded
  at app start, after the migrations, not only when a list gains focus, from one query per kind
  that selects its columns. The lists read the same rows; there is no third store and no second
  read. Today's summaries read every row's full geometry and drop it, against the spec that
  introduced them, and the record start's history read pays the same cost: both move to the
  column-selected read. A store reload is latest-wins: a trail deletion bumps both stores back to
  back, and an earlier load landing late must not overwrite a later one.
- **D123, two pure derivations.** From (rows, toggles, selection, the selected route's loaded
  state, recording phase), shared code derives:
  - the **line focus**: which classes of line are shown (trails, activities, linked activities),
    the family's keys, the key left out (the selected item, D132), and whether the rest is dimmed;
  - the **pin list**: each shown pin with its key, start, state, tag text, dimmed flag and
    priority (D136); empty while recording.
  The table of the Solution, "What the overview holds", D104, D114 and D116 are these functions'
  tests. The completed count and the family come from the same rows. The geometry stays text: it is
  parsed only for the few lines under a finger (D126).
- **D124, the toggles are persisted.** Two booleans in the map store, in its `partialize`, written
  only after hydration (T-49). Flipping one changes the line focus and the pin list, never the
  lines' data. Nothing else new is persisted; the activity selection stays session-only as today.
- **D131, the debug log.** `map` / `overview loaded` `{ trails, activities, points, ms }` at each
  rebuild of the lines; `map` / `overview backfill` `{ rows, failed, slowestMs, ms }` once per
  pass. Counts and durations only, never a coordinate.

### Map port

- **D125, one overview component on the port.** The port gains an overview component, never the
  route overlay mounted N times. Its props, by how often they change:
  - **items**, changed only by a data mutation: per item an opaque key, its class (`trail` |
    `activity` | `linkedActivity`) and its overview geometry text;
  - **focus**, small: the line focus of D123;
  - **pins**, small: the pin list of D123;
  - tokens: colours from the theme, the line zoom range, the cluster cap and radius, the press
    tolerance, the pins' font stack (D133).
  The adapter maps the focus to layer filters without knowing any rule; the toggles, the linked
  rule and the selection never reach the port as such.
- **D127, stacking.** The overview's lines are three layers under the route tier: the dimmed rest,
  the shown rest, the family; the selected route and the live track stay above, as today. Hiding
  and dimming are layer filters over the stable lines, each layer at a constant opacity (with the
  zoom fade of D107). An opacity computed per item is never used to hide: a line at such an
  opacity 0 is still tapped (spike). The slot list is generalised so the overview has slots
  without becoming a `RouteOverlay` tier. Pins and clusters are circles and symbols: with terrain on
  they draw above every line (D102), accepted.
- **D138, the overview reaches the map as files.** The Mapbox adapter writes two GeoJSON files and
  points a source at each; the engine reads, parses and tiles them on its own threads.
  - **Lines file**: the items, assembled by joining their stored text (no parse, no
    serialisation), rewritten only when the items change.
  - **Pins file**: the pin list, a few tens of KB, rewritten when the pin list changes (a
    selection, a toggle, a recording starting or ending, a data change). Its source is the one
    clustered source, so clusters hold only shown pins (D117): Mapbox clusters inside the source,
    before any layer filter, and rnmapbox on Android has no source-level filter.
  The lifecycle, decided by pure functions tested in the adapter's `__tests__` (as `tiers.ts` is):
  - files live in the app's document directory, not its cache, which Android may clear while the
    app runs;
  - each version gets a **new file name**, `[a-z0-9-]` only: the engine does not see an overwrite
    in place, and a query string is read as part of the path (spike: "File not found …json?v=7");
  - files are written synchronously on the JS thread, so writes land in order and the latest
    always wins; changes in one burst (a trail deletion bumps two stores) are coalesced into one
    write per file;
  - after a source points at a new file, files older than its predecessor are deleted; the
    predecessor stays, for a style reload already reading it; at mount, every overview file is
    deleted before the first write;
  - a style reload (layer switch) re-reads the current files by itself (spike).
  The sources only take a short path as a prop, so a re-render of a source costs nothing; the
  layers are children of their source, sources first. Measured in the spike at 100 / 300 synthetic
  items of 400 points: first load held the JS thread about 20 ms; a rewrite of the lines file
  25–55 / 75–170 ms, shown on the map 0.13–0.27 / 0.34–0.42 s later. The owner's real data is a
  tenth of the smaller figure. Passing the same data as an object (`shape`) held the JS thread
  200 / 370 ms at every change, because rnmapbox serialises a source's whole collection on every
  render of the source (`ShapeSource.tsx:263`) and parses it again on the UI thread.
- **D126, presses on the port.** The overview component reports one semantic event per press: the
  point pressed, the map's zoom and the keys hit, split into pins, lines and clusters, a cluster
  with the keys it holds and the zoom it splits at (past the cap when its starts stay merged). It
  never ranks or picks: D112, D114 and D118 are pure functions in shared code, which
  parses the overview geometry of the few lines hit to measure their distance to the point, and
  ignores keys no row has (the two files switch a few hundred ms apart). In the Mapbox adapter a
  press is the map's own press plus one rendered-features query over the overview's layers in a box
  sized in dp (rnmapbox's per-source press reports only the topmost source, and sizes its hitbox in
  physical pixels on Android). The query names the overview's own layers (every line layer, and of
  a pin the teardrop's outline, its tag and the cluster's disc), so nothing of the style's own comes
  back; among the hits, a cluster is told by its count, a pin by its point geometry and a line by
  any other; line hits come once per map tile and a teardrop and its tag are two hits, so hits are
  deduplicated by key; a cluster hit carries no keys, which the adapter reads from the pins source
  with the zoom it splits at (`getClusterLeaves`, `getClusterExpansionZoom`; spike: 15–17 ms for
  the leaves; the source must be the one the cluster came from, and there is one). A query that
  fails, during a style reload, reports nothing.
- **D128, pins are drawn by the map.** The teardrop is an icon anchored at its tip, so it is never
  clipped and takes part in placement (D136); its shape is a signed-distance image tinted with the
  theme's colours through the port (a white outline shape, the coloured body or its two halves,
  the white centre), so light and dark themes need no baked colours and the halves dim with the
  rest like the body; its shadow is a plain image. The tag is a symbol whose pill is one stretchable image fitted around the text.
  Nothing in a pin is a circle moved off its point: the spike showed Mapbox clips such a circle at
  a map tile's edge, and a pin lost its head. The cluster is a circle on its own point, its count
  drawn over others and taking no room from tags. Clustering is the provider's. Spike, on device:
  the teardrop with its tip on the line's start and the tag beside its head (from baked images;
  the tinting is Verification 5), tag priority by sort key, the cluster count,
  `✓12 · 124.6 km` fitted, a tap on the pin or the text returning the pin.
- **D132, no blink on selection.** The selected item leaves the overview only once its full dress
  is on screen (keyed on the loaded route, not on the selection). Until then its plain line stays,
  which is T-4's "plain line first" for this path.
- **D133, the pins' font.** Mapbox fetches the glyphs of a text layer per font stack. Offline, only
  the stacks the current layer uses are there, and a missing stack blanks the **whole source** it
  is in, circles included (spike: in airplane mode, `DIN Pro Medium, Arial Unicode MS Regular`
  rendered Latin, Greek, Georgian and `✓` on all three layers; the default stack, `DIN Pro Medium`
  alone and `Roboto Black` each failed and took their circles with them). So each layer's
  descriptor declares the stack its own labels use, the provider passes it to the pins, and the
  lines live in a source with no text.
- **D134, a map tap selects through its own action.** `select` asks for a fit, ends follow and
  flattens the pitch; a map tap uses a store action that sets the selection only and clears a
  pending fit left by an earlier one. A tap on nothing (D139) clears the selection through the
  card's own close, which moves no camera either. A cluster fit ends follow through the store's
  one-shot camera pattern (as `pendingFit`), since a camera move is ignored while following.

### Layers menu

- **D135, shared sheet and tile.** The cluster list is the third modal sheet over the map, after
  the Layers menu and the offline layer chooser; the shell they share (backdrop, back-dismiss,
  content height) is extracted once. The layer preview row of the offline chooser and the Layers
  menu's tiles become one preview tile. Rows for trails and activities in the cluster list and the
  family list reuse `EntityListItem`; a compact variant, if needed, is added there.

## Testing Decisions

Pure logic, test-first:

- the simplification (tolerance respected, segments kept apart, endpoints kept, empty and
  single-point input, rounding), and its output is valid GeoJSON geometry text;
- the two row builders write the overview geometry and the start point;
- the line focus and the pin list from (rows, toggles, selection, loaded route, phase): every row
  of the state table and of "What the overview holds", including both toggles off giving no pins
  at all, Activities off giving no activity pins, Trails off giving every activity a pin, recording
  giving no pins, the selected item without a pin, the family's pins first, no blink before the
  route loads, a trail deleted under its activities;
- completed and its count, from the activities' links;
- the lines file builder: joined text parses as the expected FeatureCollection (keys, classes),
  with zero items and with an item whose geometry is empty; the pins file builder likewise;
- the file lifecycle: the next name, what is deleted after a switch and at mount, one write per
  burst;
- press resolution: pin over line, several pins open the list, nearest line, trail over activity,
  the selected item never picked, unknown keys ignored, duplicate hits merged, recording gives a
  toast and no selection, the toast throttle; a tap on nothing deselects, but not within reach of
  the selected route at the press's zoom, nor with that route's place unknown, nor while recording;
- cluster press: below the cap fits the starts with the cap as the zoom limit, at the cap, or below
  it for a cluster that stays merged at the cap, opens the list;
- the map-select action leaves follow, pitch and fit untouched and clears a stale fit;
- the persisted toggles: the `partialize` output holds them, a stored state without them hydrates
  to both on, nothing is written before hydration;
- the stores: overview rows loaded at start, latest load wins when two overlap;
- the backfill: fills null rows, skips filled ones, marks unreadable ones once, waits for a
  session to end.

The `seams` test covers the port: nothing outside the provider's directory names the SDK.

Device-verified (see Verification): rendering, stacking, dimming, pins, clustering, taps, the files'
switch and reload, the menu.

## Existing shape

- **A route on the map**: the route overlay (`RouteOverlay` on the port, `MapOverlays`), one route
  per tier. Reused as is for the selected item. Not reused for the overview: its ids are per tier
  and its cost is per layer, which is why T-26 called for a collection. The slot mechanism
  (`stacking.ts` on the port, the Mapbox anchors) is generalised, not forked.
- **Selection**: `mapStore.select`, `useSelectedEntity`, `useSelectedActivity` (which already loads
  the linked trail). A map tap gets its own action beside `select` (D134); the family comes from
  the overview rows.
- **Summaries and their stores**: `TrailSummary`, `ActivitySummary`, `trailsStore`,
  `activitiesStore` and their `version`. The overview row extends the summary and the same stores
  own it (D122).
- **A modal sheet over the map**: `LayersSheet` and `OfflineLayerChooser`. The cluster list is the
  third; the shell and the preview tile are extracted (D135).
- **Rows for a trail or an activity**: `EntityListItem` (via `TrailListItem`, `ActivityListItem`)
  and the presentation formatters, for the cluster list and the family list.
- **Persisted map preference**: `mapStyleId` in the map store's `partialize`. The toggles follow it.
- **One-shot camera request**: `pendingFit` and `northResetNonce`. The cluster fit follows them.
- **Toast**: `showToast`, already used for "Finish the recording to open an activity".
- **Timed load with a log entry**: `timedRouteLoad` and `map` / `route loaded`. The overview
  rebuild follows it.
- **A post-migration one-shot**: `useLogRetention`, mounted after the migrations. The backfill
  starts there, and adds a subscription to the recording phase.
- **Files in the app's storage**: `expo-file-system` (`File`, `Paths`), already used by the GPX
  reader and the disk-space check. The overview files use the same module, inside the provider's
  directory.
- **Pure decisions inside an adapter, tested**: `src/map/providers/mapbox/tiers.ts` and its test.
  The file lifecycle follows it.
- **Nothing to share** for the simplification, clustering and map presses: none exists in the app.

## Failure modes

- **Offline.** The overview is local data. The lines need nothing; the pins need the glyphs of
  their font stack, which the offline layer carries when the stack is the layer's own (D133).
  If a layer's stack is wrong, its pins vanish, teardrops and all, while the lines stay: Verification 9
  guards it on every layer.
- **Unreadable geometry** (backfill or save). The item has no line and no pin; it stays in its
  list and can be selected from there, where today's handling applies. Logged once.
- **Empty or single-point geometry.** No line; a pin at its only position, its tag reading the
  stored distance (`0 m` if none).
- **Backfill interrupted** (app killed). Rows already filled stay; the rest are filled at the next
  start. Meanwhile the overview shows what is filled.
- **First launch after the update, recording at once.** The backfill waits for the session to end;
  until then the overview shows the rows already filled, possibly none.
- **Overview rows fail to load.** The overview is empty, the failure is logged, the lists show
  their own error as today, the map and the selection work. The next change to a store retries.
- **Overview file write fails** (disk full). The source keeps its previous file, the failure is
  logged, and the next change retries; at first launch with no file, the overview stays empty and
  the map works as today.
- **Overview file missing** (deleted from outside). The engine logs "File not found" on its next
  read and that source draws nothing; the next change or start writes a new file.
- **Lines and pins out of step** for a few hundred ms after a data change: a pin with no line yet,
  or the reverse. Presses ignore keys no row has.
- **Item deleted while shown.** The stores' `version` rebuilds the overview; a selection on a
  deleted item is cleared as today. Deleting a trail unlinks its activities, which then appear in
  the overview with their own pins.
- **Tap on something gone** (a stale press). The press ignores it; nothing is selected or
  deselected.
- **Press during a style reload.** The query fails; nothing is selected or deselected.
- **Cluster tap while following.** Follow ends, then the fit runs.
- **Layer switch with the overview on.** The style reloads; the overview's sources and layers come
  back with the map's children, as the route's do (D83), and re-read the current files (spike).
- **Nothing saved.** No lines, no pins; the toggles are still offered.
- **Many items.** Clusters and the zoom threshold bound what is drawn far out; focus changes do not
  touch the lines; the pins file stays small; the cluster list scrolls; each rebuild is timed in
  the log. The whole set is loaded at start: loading by viewport would re-send data at the end of
  every pan, and only pays off at thousands of items (with bounding-box columns to query by).
- **Render-time throw.** The derivations and press resolution are pure. A throw in a derivation
  leaves the overview empty, no line and no pin, and is logged once per derivation that throws, not
  at every render; a throw in resolving a press is logged and the press does nothing. The map and
  the card do not depend on the overview.
- **Cancel mid-operation.** Closing the cluster list or the Layers menu selects nothing and leaves
  the toggles as last set.

## Verification

On device, by `device-check`; feel (10) is the owner's. Items marked *(spike)* were seen on
2026-11-11 with throwaway code (`.scratch/spike-overview/`) and are re-checked on the real build.

1. Cold start with saved trails and activities: lines and pins appear without visiting a list.
2. Far out, pins and clusters only; lines fade in past the threshold; a line below the range is not
   tappable *(spike)*.
3. `trailLine` and `activityLine` as thin lines read on Outdoors and on Satellite, and are told
   apart from the slope colours of a selected route.
4. Stacking: dimmed overview and family under the selected route, live track above.
5. Pins: the three states, the teardrop's tip on the line's start and the tag beside its head
   *(spike)*, `✓12 · 124.6 km` fitted, the selected family's and uncompleted trails' tags kept
   first *(spike)*; a tag never under a neighbour's teardrop; the tinted teardrop in light and dark
   themes; terrain on, pitched; the completed trail's split readable at 16 dp in light and dark, on
   each layer and dimmed, and all trail colour with Activities off.
6. A tap on a pin's teardrop and on its text *(spike)*, on a line, on two crossing lines (the nearer
   wins), on the selected route (falls through, the selection kept), on the bare map (the card
   closes); no camera move with follow off.
7. A cluster fits its starts up to the cap; two items on the same start stay a cluster past the cap
   *(spike)* and open the list; turning Activities off removes them from clusters and their counts
   *(spike: a layer filter alone does not)*.
8. Recording: no pins, overview dimmed, a tap gives one toast and the recording card is untouched;
   five quick taps give one toast.
9. Airplane mode over an offline map, on each layer: lines, teardrops, tags and cluster counts render
   *(spike: the tag's font stack, all three layers)*. On a phone whose map has never shown the pins
   online, if one can be had without clearing the owner's data.
10. Owner: the tap target is comfortable, the dimming level and the cluster reach feel right.
11. The Layers menu: tiles, both rows, stays open, the choice surviving a relaunch, TalkBack reads
    radios and checkboxes.
12. A selection and a toggle with the owner's data and with about 300 seeded items: the map does
    not stall (the pins file rewrite and the restyle, timed). Panning and pinching with 300 items:
    no rebuild in the log, no visible stutter (feel, the owner's).
13. The files: a save shows on the map within half a second *(spike)*; after a layer switch the
    overview is back *(spike)*; after a relaunch only the current and previous file of each
    source are left.
14. The debug log holds `overview loaded` and `overview backfill` with plausible figures and no
    coordinate.

## Out of Scope

- **Looking at another trail while recording** (its card, without changing the trail followed):
  [[T-99-peek-while-recording]]. It would lift the toast of D114 and the list rules of §4.7.
- Picture pins ([[T-27-trail-pictures]]), waypoints ([[T-28-render-waypoints]]), long-press
  ([[T-33-long-press-open-maps]]); the last two can reuse D125–D126.
- Completion by coverage; trail names along the lines; a chooser for crossing lines; a cluster
  ring split by kind; a zoom threshold per item.
- Units: the tag uses the app's distance formatter and follows [[T-19-units-setting]] when it lands
  (a units change rebuilds the pins).
- The cost of selecting one long trail ([[T-4-progressive-route-rendering]]): D132 shows the plain
  line meanwhile, but what a selection loads is unchanged.

## Rejected alternatives

- **The overview as an object passed to the source (`shape`)**: measured and working, but every
  data change and every stray re-render of the source serialises the whole collection on the JS
  thread (200 / 370 ms at 100 / 300 items) and parses it again on the UI thread, and keeping the
  source from re-rendering rests on a discipline nothing tests.
- **A pre-built string through a patched rnmapbox**: B's speed without the file, but the overview's
  foundation would rest on a patch of the map SDK, re-checked at every upgrade, and unknown on
  MapLibre.
- **A canvas drawn over the map** (as in a Leaflet project of the owner's): Mapbox already draws
  the lines on the GPU in the map's own pass; an overlay would trail the camera by a frame on
  every gesture, could not follow terrain or hide behind ridges, and would be a second map engine
  to maintain beside the seam.
- **Loading only what is in view**: re-sends data after every pan; see Failure modes, "Many
  items".
- **Hiding pins with layer filters over one stable points file**: clusters are made inside the
  source before any filter, so a hidden pin is still counted, still pulls its cluster's position,
  and still listed (spike: a cluster showed 2 with one member filtered out). A source-level filter
  would fix it but is not available on Android in rnmapbox; `clusterProperties` can correct the
  count but not the membership or the position.
- **Hiding or dimming by an opacity computed per item**: a line at such an opacity 0 still answers a
  tap (spike), and such an opacity does not animate.
- **A fade-in of the overview at launch** (ruled by the owner, then dropped): with dimming by
  filters it was buildable, but cost restyles at every launch for a moment nobody watches.
- **A cluster cap at zoom 15 with a 40 px radius**: it freezes the merge distance at that scale,
  about 70–140 m, so trailheads a street apart would never separate and the disc would sit between
  them.
- **The overview files in the cache directory**: Android may clear it while the app runs, and the
  next layer switch would leave the overview empty until the next change.
- **Asynchronous writes with temporary files and renames**: the order of writes is then a race to
  manage, for writes that take tens of ms; synchronous writes of new names are simpler and safe.
- **A third store for the overview**: two owners of the same rows, two reads per change, and lists
  that can disagree with the map for a moment.
- **Cycling through stacked activities on repeated taps**: with a trail and its activities on the
  same path, it either ping-pongs between two or reads as random; the card's list is exact.
- **Family lines over the selected route**: several noisy tracks would cover the slope colours the
  owner reads; under it they show only where a walk strayed, which is the point.
- **A larger pin for the selected item**: it could sink into a cluster and would sit on the route's
  endpoint dot.
- **The distance as haloed text, no tag**: lighter and portable, but not what the owner asked for;
  it stays the fallback on a provider without stretchable images.
- **The disc inside the tag**: it reads as an icon in a label, leaves unclear which point is the
  place, and looks broken when the tag gives way.
- **A disc on the start with the tag trailing from it** (drawn in the device gallery, with the
  callout and the flag below): clear once the line visibly leaves it, but on its own it does not
  say that the start is under the disc.
- **A callout bubble with a notch on the start**: precise and light, but the closest to another
  hiking app's pin.
- **A trailhead flag** (a dot on the start, a pole, the disc and tag on top): on-theme, but the
  tallest, so the most cluttered where pins are dense.
- **A tag centred on the middle of the walk**: loses the trailhead (where the owner goes, and what
  a cluster of starts means), lands on the far side of a loop, and jumps away on selection.
- **Ranking presses in the adapter**: the rule would sit behind the seam, untestable.
- **Simplifying at each launch, no column**: parsing every full geometry at every launch, growing
  with every activity.
- **A "Layers" retitle**: the menu keeps its name; the glossary's **Layer** stays the map's style,
  and the menu's second row is labelled "Show on map".

## Decisions taken without the owner

The owner ruled D103–D119, D130, the first challenge's seven user-visible points (no cycling, the
family list on both cards, the family under the route, no selected pin, the cluster list, the tap
while following, the item under the card), the count on the tag, the pill, the teardrop and its size
(D116), the tag priority (D136), the overview as files (D138); and in the second challenge, every
activity pinned when trails are hidden (D104), the cluster reach (D117) and dropping the fade-in;
and at the first look at the build, the tap on nothing (D139) and the completed trail's split
teardrop (D116).
These were taken while writing and are theirs to overturn:

- **D120–D122**: the stored overview geometry and start point, its backfill, the existing stores
  owning the rows and loading them at start, and the summaries' read fixed in the same change.
- **D123–D127**: the line focus and pin list as the two derivations, the port's props, the three
  line layers.
- **D138's lifecycle details**: document directory, synchronous writes, keeping one predecessor.
- **D133**: a font stack per layer, declared on the layer's descriptor.
- **D135**: the shared sheet shell and preview tile.
- **D136's family-first priority** and the teardrops reserving their place against tags.
- **D128's tinted teardrop images.**
- **D114's throttle**: a few seconds per item.
- **D139's reach**: the press tolerance plus the overview geometry's tolerance, and the selection
  kept while its route's place is unknown.

## Further Notes

- **The escape hatch.** MapLibre React Native has clustering, presses with features, cluster
  leaves, data-driven opacity and sources read from a file URL, but does not expose stretchable
  images today: on a swap, the tag falls back to haloed text (or waits for an upstream change), the
  teardrop and the rest port as is.
- **Spike evidence**: `.scratch/spike-overview/` (code, gitignored: `Spike.tsx` for fonts, the first
  pin, clusters and dimming; `SpikeB.tsx` for the file source and the map-level press; `SpikeC.tsx`
  for per-item opacity, filtered clusters, a pin, cluster leaves and the owner's data sizes;
  `SpikeD.tsx` and `SpikeE.tsx` for the galleries of sizes and anchor shapes) and
  `.scratch/device-checks/2026-11-11/` (screenshots 60–75, `spike-*`, `pin-gallery-crop`,
  `anchor-gallery-3-crop`).
- Still owed to a device: offline glyphs on a never-online install; the teardrops' reserved place
  against tags; the tinted teardrop images; the cap and radius of D117; the pins file rewrite
  timed on a selection.
- Suggested build order, for the split into work items, each shippable alone: the overview geometry,
  start point and backfill, with the stores loading overview rows at start → the line focus and pin
  list derivations → the overview component with the lines file, focus and dimming → the Layers
  menu's tiles with the two toggles (the tiles first, so the toggles are born as tiles) → pins and
  clusters → presses and selection from the map → the family and the card's list → the shared
  sheet for the cluster list.
- The plan is [[2026-11-11-overview-on-map]].
