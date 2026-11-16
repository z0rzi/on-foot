---
severity: investigate
category: bug
size:
triage:
origin: agent
filed: 2026-11-16
from: "[[2026-11-15-check-hooks-design]]"
blocked_by: []
---
# T-120: the offline download's size estimate is a tenth of the pack it downloads

In the check-hooks final check of 2026-11-16 (its report, part 2, step 9 and "Other
observations"), the download sheet read `~4 MB` for a 300 m trail's Outdoors map before the
download; Settings → Offline maps then listed 40 MB for that pack, and 40 MB for a second 300 m
trail's.

The estimate is a tile count times a flat 25 KB per vector tile (`src/map/offline/estimate.ts:27-35`,
`src/map/offline/constants.ts:7-8`), over zooms 10 to 16. A small pack's actual size is likely
dominated by what the tile count leaves out (the style's resources, fonts and sprites, the
terrain's DEM tiles), which would make the ratio worst on short trails; not measured.

The estimate is not only shown: it feeds the disk-space refusal and the mobile-data prompt
(`src/map/offline/plan.ts:22`, `src/map/offline/downloadConsent.ts`), both of which then under-ask
by the same factor. The disk-space refusal is still unchecked on a device (`device-checks.md`).

## A longer trail, 2026-11-16

In the check-hooks owed checks (release build of `f864514`), a 6 km straight line's Outdoors map
read `~13 MB` before the download and `✓ Downloaded · 49 MB` once done: 3.8 times the estimate, against
10 for the 300 m trails. Across the three, the actual size is about the estimate plus 36 MB (4 →
40, 13 → 49), which fits the guess above: the per-tile part about right, a fixed part the count
leaves out. So "ten times" holds for short trails only.
