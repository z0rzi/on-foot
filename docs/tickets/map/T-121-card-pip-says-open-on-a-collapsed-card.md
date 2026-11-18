---
severity: minor
category: bug
size:
triage:
origin: agent
filed: 2026-11-16
from: "device check, 2026-11-16"
blocked_by: ["[[T-122-open-card-clips-grown-ahead-lines]]"]
---
# T-121: after the offline map chooser, the trail card is collapsed but its pip still says it is open

Seen twice in the check-hooks owed checks of 2026-11-16 (release build of `f864514`), with
`DEVCHECK owed download` selected. The trail card was open (`sheet settled {"mode":"trail",
"index":1}` at 10:59:54.812). Its ⋮ → Edit offline map opened the chooser, Satellite was ticked and
Apply tapped. The card was then drawn collapsed to its pill and stayed so after Apply, while its pip
still read **Show less**, the open state, and no `sheet settled` was written. The first tap on the
pip changed nothing visible and wrote `sheet settled {"index":0}` (11:01:16.231), the pip now
reading **Show more**; a second tap opened the card. Evidence:
`.scratch/device-checks/2026-11-16/29-downloading.strip.png`, `30-card-after-download.half.png`.

From the source: the pip's label is the card's `open` (`src/map/CardPipRow.tsx:23`), which
`useSheetOpen` reads from the sheet's `animatedIndex` (`src/map/MapInfoSheet.tsx:54`), and the
tap's `toggle` snaps to the other index from `open` (`MapInfoSheet.tsx:70`). So the first tap
snapping to the collapsed index, with no visible change, follows from `open` still being true: the
card was moved down without its `animatedIndex`, or its `onChange` (`MapInfoSheet.tsx:123`),
taking the move. The chooser is a gorhom `BottomSheetModal` opened from the card's ⋮
(`src/trails/TrailActions.tsx:15,43`) over the card's own `BottomSheet`; what moved the card is
not traced. A suspect: the snap points are held while open (`MapInfoSheet.tsx:64-67`) and the
download's progress replaces the badge in the card's content.

[[T-44-activity-sheet-offscreen-after-trail-rename]] is perhaps the same class, a card drawn
where its sheet's state does not say with no `sheet settled` written; it has not been
reproduced.

## Folded into T-122 (owner, 2026-11-18)

Worked with [[T-122-open-card-clips-grown-ahead-lines]], whose fix changes the held open height
this ticket suspects (`MapInfoSheet.tsx:64-67`). What moved there: the repro (a download started
with the trail card open, its badge replaced by the progress, read for `sheet settled` and the
pip's label), and the criterion that after any change of the card's content while open, the card
is drawn where its sheet's state says and the pip's label agrees. If the repro shows another
cause, this ticket is unfolded and keeps its own fix.
