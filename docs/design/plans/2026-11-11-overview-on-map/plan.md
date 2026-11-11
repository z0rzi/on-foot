# Overview on the map

Spec: [[2026-11-11-overview-on-map-design]]. Every saved trail and activity drawn on the map at
once, with teardrop pins, clusters, taps that select, the family in the card, and the Layers menu
as tiles with two toggles. Nine items: a prefactor, the stored geometry, then the map in the order
a user would meet it.

| # | Item | Delivers |
| --- | --- | --- |
| 01 | The lists read only their columns, and the stores load at launch | Prefactor: no full geometry read for a list; trails and activities in memory from launch; the newest load wins |
| 02 | Every trail and activity keeps a light overview geometry | Simplified geometry and start point stored at save, backfill of existing rows, `overview backfill` in the log |
| 03 | All trails and activities are drawn on the map | The overview component on the port, the lines file, thin plain lines past a zoom threshold, the linked-activity rule |
| 04 | A selection or a recording brings its family forward and dims the rest | Line focus: dimmed rest, slim family under the selected route, no blink, dimmed while recording |
| 05 | The Layers menu is tiles, with Trails and Activities toggles | Shared sheet shell and preview tile, the menu stays open, the toggles persisted and applied to the lines |
| 06 | Every start has a pin, and close pins merge into clusters | Pins file, tinted teardrop and tag, `✓N`, tag priority, collisions, the cluster cap |
| 07 | A tap on a line or a pin selects it | Press event on the port, press resolution, map-select action without camera move, toast while recording |
| 08 | A tap on a cluster fits it or lists it | Fit below the cap, the list modal at the cap; closes T-26 |
| 09 | The trail and activity cards list the family's activities | "Completed N×" with a row per activity, a row selects it |

09 needs only 01 and can be built beside 02–08.

## What the build needs beyond the spec

- **The spikes are a reference, not a base.** `.scratch/spike-overview/` (gitignored, on the
  owner's machine) holds the throwaway code behind every measured claim of the spec: the pill and
  teardrop images and their stretch metadata, the map-level press query, the file source. Read it
  for the parameters that worked; write the real code from the spec. The teardrop there is baked
  per colour; the real one is tinted (D128), which no spike has shown yet.
- **Device checks are owed per item**, through the `device-check` skill, against the spec's
  Verification list; an item lists which numbers it owes. Claims a device could not confirm go to
  `docs/tickets/device-checks.md`.
- **The seams.** `expo-file-system` used for the overview files stays inside the Mapbox provider's
  directory; nothing outside `src/map/providers/` names rnmapbox. If a new boundary appears, it is
  registered in `src/architecture/seams.ts` in the same item.
- **Debug-log entries** added by an item are listed in `docs/architecture/debug-log.md` in that
  item, and never carry a coordinate.
- **The glossary** already holds Overview, Family, Completed, Pin and Cluster; an item that finds
  a term missing adds it in the same change.
