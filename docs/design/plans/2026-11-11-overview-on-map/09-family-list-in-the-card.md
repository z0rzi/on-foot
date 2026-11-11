---
status: open
blocked_by: ["[[01-columns-and-stores-at-launch]]"]
closes: []
---
# 09: the trail and activity cards list the family's activities

**What to build:** a trail's card shows, under a "Completed N×" heading, its linked activities,
most recent first, each row with its date and duration; a tap on a row selects that activity. A
linked activity's card shows the same list, its own row marked as the one shown. Absent when the
trail has no activity; not on the recording card (D115). The family and the count come from the
stores' rows (01); rows reuse `EntityListItem` and the presentation formatters, with a compact
variant added there if needed.

- [ ] The family and its order derived from the rows, pure and tested (shared with the overview's
      completed count when 06 lands, not duplicated)
- [ ] Selecting a row from the card behaves as a selection from the Activities list
- [ ] Device: the list on a trail with activities, on a linked activity (its row marked), absent on
      a trail without
- [ ] `npm run verify` green
