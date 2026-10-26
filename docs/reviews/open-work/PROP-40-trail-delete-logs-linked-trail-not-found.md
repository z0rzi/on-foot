---
severity: minor
category: bug
size: S
triage: needs-triage
source: "device check, 2026-10-26"
blocked_by: []
---
# PROP-40: deleting a trail logs `linked trail not found` while a linking activity is selected

Residue of ERR-7, found by its device check. ERR-7's fix holds in the data: after deleting a linked
trail, the activity reopens with no link and no warning. But at the moment of the delete, with the
activity still selected on the (hidden) Map tab, the debug log gets
`23:08:54 warn error linked trail not found {"id":43}` — the exact false alarm ERR-7 set out to
remove, now on every delete of a linked trail instead of every open.

Path: `trailsStore.removeTrail` (`src/store/trailsStore.ts:37-40`) calls
`trailsRepository.deleteTrail`, which also nulls `activities.linked_trail_id`
(`src/data/db/trailsRepository.ts:28-29`), then bumps only the **trails** version.
`ActivityInfoSheet` (`src/map/ActivityInfoSheet.tsx:26-33`) is keyed to that version and reloads
`activity.linkedTrailId` — but the selected activity (`src/map/useSelectedActivity.ts`, keyed to the
activities version) was never re-read, so it still carries id 43, and `useLoadedEntity` logs the
miss (`src/components/useLoadedEntity.ts:33`).

The root is that one mutation changes two entities and publishes one. The sheet withdraws the
button correctly, so this is log noise, not a UI bug. Fix at the store layer (the trail delete
also invalidates activities), not by muting the warning. Evidence:
`.scratch/device-checks/2026-10-26/B/51-*`, `55-*`, `57-debuglog-linked-trail-not-found.png`.
