---
status: open
blocked_by: ["[[02-overview-geometry-stored]]"]
closes: []
---
# 03: all trails and activities are drawn on the map

**What to build:** on opening the map, every saved trail and activity is there as a thin plain
line (trail colour, activity colour; no casing, arrows, slope colours or endpoint dots), appearing
past a zoom threshold and fading in over a short zoom range; below it, nothing is laid out or
tappable (D106, D107). With both kinds shown, an activity linked to a trail is left out (D104). The
map port gains the overview component (D125) taking the items (key, class, overview geometry
text); the Mapbox adapter writes the lines file by joining the stored text and points a source at
it, with the lifecycle of D138: document directory, a new `[a-z0-9-]` name per version, written
synchronously, one write per burst of changes, the predecessor kept until the switch, every
overview file cleared at mount, decided by pure functions tested in the adapter. The overview's
line layers take a slot under the route tier, the slot list generalised without making the
overview a `RouteOverlay` tier (D127). The selected route and the live track draw as today, above.
The debug log gains `map` / `overview loaded` `{ trails, activities, points, ms }`.

- [ ] Lines-file builder: joined text parses as the expected FeatureCollection (keys, classes),
      with zero items and with an empty geometry (tests)
- [ ] File lifecycle: next name, what is deleted after a switch and at mount, one write per burst
      (tests)
- [ ] The line focus derivation exists for the classes shown (the linked-activity rule), tested;
      the rest of the focus comes in 04
- [ ] Nothing outside `src/map/providers/` names rnmapbox or `expo-file-system` for this; the
      `seams` test is green
- [ ] Device: Verification 1, 2, 3 (thin lines on Outdoors and Satellite), 13 (a save shows within
      half a second; back after a layer switch; one current and one previous file after a
      relaunch)
- [ ] `npm run verify` green
