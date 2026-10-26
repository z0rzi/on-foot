---
severity: should-fix
category: bug
size: S
triage: ready-for-agent
source: "[[2026-09-10-full-review]]"
blocked_by: []
---
# ERR-7: a deleted trail leaves a permanently dangling `linked_trail_id`

`schema.ts:21,41` declares the column as a plain `integer` on both `activities` and
`recording_sessions` — no foreign key, no `ON DELETE SET NULL` — and `trailsRepository.ts:26-28`'s
`deleteTrail` removes only the trail row. So the link is stuck forever, and the loaded-entity hook
writes a `warn` every time that activity's sheet opens. Repeating benign noise is what degrades
the debug log. Fix: null the column in `deleteTrail`, or add the FK and let SQLite enforce it.

## Agent Brief

**Category:** bug
**Summary:** Deleting a trail clears every `linkedTrailId` pointing at it, and existing dangling links are cleaned once.

**Current behavior:**
`TrailsRepository.deleteTrail(id)` removes only the trail row. Activities and recording sessions
whose `linkedTrailId` equals that id keep it forever, and the loaded-entity hook logs a `warn` each
time such an activity's sheet opens.

**Desired behavior:**
Deleting a trail sets `linkedTrailId` to null on every activity and recording session that points at
it, in the same transaction as the delete. A one-time cleanup (a migration) nulls links that already
point at a trail that no longer exists. Decision taken 2026-10-26: null in `deleteTrail`, not a
foreign key, which would need a table rebuild.

**Key interfaces:**
- `TrailsRepository.deleteTrail(id: number): Promise<void>`: contract unchanged; the SQLite
  implementation gains the clearing step inside a transaction.
- The `activities` and `recording_sessions` tables' `linked_trail_id` column.

**Acceptance criteria:**
- [ ] After `deleteTrail(id)`, no activity or recording session has `linkedTrailId === id`.
- [ ] The delete and the clearing happen in one transaction.
- [ ] A migration nulls existing `linked_trail_id` values with no matching trail.
- [ ] Opening an activity whose trail was deleted logs no warning.

**Out of scope:**
- Adding a foreign key or `ON DELETE SET NULL` to the schema.
- Changing how a linked trail is shown in the activity sheet.
