---
status: open
blocked_by: ["[[06-pins-and-clusters]]"]
closes: []
---
# 07: a tap on a line or a pin selects it

**What to build:** idle, a tap on a pin or a line of the overview opens its card, as a selection
from a list does, but the camera, the pitch and the follow mode stay as they are (D113, D134).
Pins win over lines; among lines the nearest to the finger, a trail over an activity at equal
distance, never the selected item, whose own line lets the tap fall through (D112). While
recording, a tap on an overview line shows the existing toast "<name> · <distance>", once per item
within a few seconds, and selects nothing (D114). The overview component reports one press event:
the point and the keys hit as pins, lines and clusters; the Mapbox adapter builds it from the
map's own press and one rendered-features query in a dp box over the overview's layers,
deduplicating by key, and a failed query reports nothing (D126). Shared code resolves the press,
parsing only the hit lines' overview geometry and ignoring keys no row has. Several pins under the
finger are left for 08's list; until then the nearest pin is taken.

- [ ] Press resolution: pin over line, nearest line, trail over activity, the selected item never
      picked, unknown keys ignored, duplicates merged, recording gives a toast and no selection,
      the throttle (tests)
- [ ] The map-select action sets the selection only, leaves follow, pitch and fit untouched and
      clears a stale fit (test)
- [ ] Device: Verification 6 (a tap on a pin and its text, a line, two crossing lines, the
      selected route; no camera move with follow off), 8 (recording: one toast, five quick taps
      give one)
- [ ] `npm run verify` green
