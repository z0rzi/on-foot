---
status: open
blocked_by: ["[[05-layers-menu-tiles-and-toggles]]"]
closes: []
---
# 06: every start has a pin, and close pins merge into clusters

**What to build:** each shown trail and activity has a pin at its start: a teardrop with its tip on
the start point and a white pill tag beside its head giving the distance; trail colour with a white
centre for a trail, a white check and `✓<count> · <distance>` for a completed trail, the activity
colour for an activity (D116, D105). With trails shown, a family has one pin, its trail's; with
trails hidden, every activity has its own (D104); the selected item has none; while recording
there are none (D114). Where tags collide they give way and the teardrops stay; the selected
family's tags are kept first, then uncompleted trails, completed trails, activities; a tag never
runs under another pin (D136). Pins too close merge into a dark cluster with its count, which holds
only shown pins and, past a cap around zoom 17, stays a cluster at every zoom (D117). The pin list
derivation (D123) feeds a small pins file rewritten when it changes (D138); the teardrop is an
icon tinted with the theme's colours, the pill a stretchable image, the text in the layer's own
font stack declared on its descriptor (D128, D133). Dimmed with the rest when something is
selected (D108).

- [ ] Pin list from (rows, toggles, selection, phase): both toggles off gives none, Activities off
      gives no activity pins, Trails off gives every activity a pin, recording gives none, the
      selected item has none, the family's first, completed count (tests)
- [ ] Pins-file builder parses as expected (test)
- [ ] Each layer descriptor declares its labels' font stack, passed to the pins
- [ ] Device: Verification 5 (states, tip on the line's start, tags fitted, priority, no tag under
      a neighbour, tinting in light and dark, terrain on, pitched), 7 (clusters, same start past the
      cap, a toggle removes pins from clusters), 9 (airplane mode on each layer), 12 (pins part:
      a selection and a toggle timed)
- [ ] `npm run verify` green
