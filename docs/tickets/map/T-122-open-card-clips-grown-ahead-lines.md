---
severity: minor
category: bug
size:
triage:
origin: agent
filed: 2026-11-18
from: "device check, 2026-11-17"
blocked_by: []
---
# T-122: an open recording card keeps its height when the ahead lines grow, hiding the climb line

Seen in the device check of 2026-11-17 (release build of `9c71917`, agent session along
`DEVCHECK owed climb`, mocked GPS). The recording card was opened right after the start, while the
ahead lines read the one line "Not on the trail". Twenty metres on, they became two, "Trail end in
31 min (2.2 km)" and "Next climb in 12 min (979 m) · 79 m to climb", and the card kept its
height: the climb line sat half under the nav row (Trails, Activities, Settings) for the rest of
the walk, through "Climbing …" and "No climb left". Collapsing and reopening the card showed both
lines whole. Evidence: `.scratch/device-checks/2026-11-17/06-v24-near-start.half.png`,
`10-v24-at-end.half.png` (clipped), `card-reopened-crop.png` (after the reopen). Whether the
details could be scrolled to bring the line up was not tried.

From the source: this is D43 ([[2026-11-06-hiking-ux-design]]) as built. The open height is
measured only while the card is collapsed (`appliedOpenHeight`, `src/map/sheetSnapPoints.ts:25-28`,
used at `src/map/MapInfoSheet.tsx:64-67`), so an open card never moves on its own; D43 was ruled
that way because a content-driven height moved the sheet by itself. The fix is either an owner
ruling that reverses D43 for content that grows while open, or keeping the height and making the
grown details reach clear of the nav row by scrolling (the details' clip and scroll view,
`MapInfoSheet.tsx:139-151`, sized `nextOpenHeight - rest.height` with `paddingBottom:
rest.navRowHeight`). The off-trail line is the common way in: a recording's card opened before the
first fixes, or off the trail, reads one line.

## Ruling (owner, 2026-11-18)

D43 is reversed for content that grows while the card is open: the open card takes up its new
measured height, rather than keeping its height and scrolling the grown details clear of the nav
row. The commit that fixes it revises D43's row in [[2026-11-06-hiking-ux-design]], keeping the
reason it was first ruled (a content-driven height moved the sheet on its own) as what the fix must
not bring back.

## Related

[[T-121-card-pip-says-open-on-a-collapsed-card]] suspects the same held open height reacting to
content that changes while the card is open (a download's progress replacing the badge); its
cause is not traced. A fix here that lets an open card re-snap could produce T-121's kind of move.
