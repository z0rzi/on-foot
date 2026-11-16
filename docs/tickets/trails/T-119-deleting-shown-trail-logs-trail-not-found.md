---
severity: minor
category: bug
size: S
triage:
origin: agent
filed: 2026-11-16
from: "[[2026-11-15-check-hooks-design]]"
blocked_by: []
---
# T-119: deleting a trail while it is shown logs `trail not found`

In the check-hooks final check of 2026-11-16 (its report, part 2, step 15 and "Other
observations"), a trail shown on the map and deleted through Trail actions → Delete trail left
`10:15:03.873 warn error trail not found {"id":104}` in the debug log, right after the delete
(capture `.scratch/device-checks/2026-11-16/22-app-log.txt`). The delete itself worked.

From the source: `deleteTrail` (`src/trails/deleteTrail.ts:16-23`) removes the trail, then calls
`forgetEntity`. `removeTrail`'s `commit()` bumps the trails store's `version`
(`src/store/trailsStore.ts:22-25`, `:43-50`), and `useLoadedEntity`'s effect is keyed on it
(`src/components/useLoadedEntity.ts:50`), so the shown trail is loaded again before
`forgetEntity` clears the selection. The load answers null, and the `not found` warn is written
before the liveness check (`useLoadedEntity.ts:33-34`), so it lands even when the effect was
already cancelled. If the load lands while the effect is still live, `onUnavailable` fires as
well: while a recording runs, `announceLostRecordingTrail` (`src/map/useSelectedTrail.ts:8`)
then toasts "The recording's trail is no longer available" beside the delete's own `Trail deleted ·
Recording without a trail`. Not seen here, as no recording ran.

The same defect class was fixed for an activity's linked trail (PROP-40, seen fixed on
2026-11-02 in `device-checks.md`: "deleting a linked trail with its activity selected logs no
`linked trail not found`"). A false `not found` in the log is what a field report is read by.
The fix may land in `useLoadedEntity`, where [[T-107-reselection-derives-route-twice]] has its
cause too; if so, the two go together.
