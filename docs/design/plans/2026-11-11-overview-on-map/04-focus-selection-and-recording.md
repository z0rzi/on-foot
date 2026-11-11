---
status: open
blocked_by: ["[[03-overview-lines-on-the-map]]"]
closes: []
---
# 04: a selection or a recording brings its family forward and dims the rest

**What to build:** selecting a trail, or an activity linked to one, keeps it in full dress and
draws the rest of its family as slim plain lines at full strength under the selected route, while
the rest of the overview dims (D108, D109, D110, D127). The selected item's plain line stays until
its full dress is on screen, so nothing blinks (D132). While recording or paused, the overview is
dimmed and the followed trail's family is not drawn (D114, lines part). The line focus derivation
(D123) gives the family's keys, the key left out and whether the rest is dimmed; the adapter turns
it into filters over three layers (dimmed rest, shown rest, family) at constant opacity, never an
opacity per item, and the lines file is not rewritten by any of it.

- [ ] Line focus from (rows, toggles, selection, loaded route, phase): every row of the spec's
      state table, the family, no blink before the route loads, a trail deleted under its
      activities (tests)
- [ ] A selection or a recording start does not rewrite the lines file (adapter test or log)
- [ ] Device: Verification 4 (stacking), the dimming in the three states; Verification 12, line
      part (a selection does not stall the map with about 300 seeded items)
- [ ] `npm run verify` green
