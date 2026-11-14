---
severity: minor
category: refactor
size: S
triage: ready-for-agent
origin: agent
filed: 2026-11-14
from: "DUP-3, DUP-4 and DUP-6 in [[2026-11-14-full-review]]"
blocked_by: []
---
# T-104: the trail and activity siblings make different choices for the same shape

`CODING_STANDARDS.md` "Sibling functions make the same choices". Each pair passes the duplication
gate because the copies are short or renamed:

- **List screens.** `app/trails.tsx:23,25` uses a hook (`useTrailActionsMenu`) and a named failure
  (`TRAILS_REFRESH_FAILURE`, `src/trails/refreshFailure.ts`). `app/activities.tsx:19-25` keeps the
  menu in an inline `useState` and the failure as an inline literal.
- **Metric tiles.** `trailMetricTiles` (`src/trails/format.ts:19`) serves the trail sheet and the
  trail form. `src/map/ActivityInfoSheet.tsx` and `src/activities/ActivityForm.tsx` each build their
  own tile list inline.
- **Sheet styles.** `titleRow` and `summaryRow`, with the `name`/`summary` styles beside them, are
  verbatim in `src/trails/TrailInfoSheet.tsx:81-85` and `src/map/ActivityInfoSheet.tsx:77-80`.
- **Placement.** The trail sheet lives in `src/trails/` and the recording sheet in
  `src/recording/`, but the activity sheet in `src/map/`.
- **DUP-4.** `src/map/PausedControls.tsx:35` re-derives the recording's trail
  (`sel?.kind === 'trail' ? sel.id : null`). That is `alongTrailId` (`src/recording/alongTrail.ts:15`),
  whose comment names this call site, and `currentAlongTrailId()`
  (`src/recording/currentAlongTrail.ts:5`) is its imperative read. It matters for T-99 (peek while
  recording), which would split the trail shown from the trail followed.
- **DUP-6.** `removeForTrail` filters packs by hand (`src/map/offline/offlineStore.ts:127-128`,
  `parsePackId(…)?.trailId === trailId` twice). That is the predicate `packsForTrail`
  (`src/map/offline/packId.ts`) was made for in the previous review's DUP-7.

## Agent Brief

**Category:** refactor
**Summary:** Put the activity side on the trail side's patterns, and retire the two hand-rolled
re-derivations.

**Desired behavior:**
- The activities list takes its action menu from a hook and its refresh failure from a named
  constant, beside the trails ones.
- An `activityMetricTiles` in `src/activities/` serves the activity sheet and the activity form, as
  `trailMetricTiles` does for trails. A `variant` parameter only if the two lists really differ.
- One shared title/summary row for the sheets: a component or a shared style, the worker's call,
  written in the commit.
- `ActivityInfoSheet` moves to `src/activities/`.
- `PausedControls` links `currentAlongTrailId()`.
- `removeForTrail` goes through `packsForTrail` for the registry packs, and the same predicate for
  the progress keys.

**Acceptance criteria:**
- [ ] Each bullet above holds. No rendered change is intended.
- [ ] Tests for `activityMetricTiles` and for `removeForTrail`'s progress keys.
- [ ] A device check is owed for the sheets' title and summary rows: render, trail and activity
      side. Listed in `docs/tickets/device-checks.md` if no device is free.
- [ ] `npm run verify` green.

**Out of scope:**
- The trail/activity store pair (previous DUP-6, accepted until a third entity store appears).
- T-44 (activity sheet off-screen after a rename). The move changes its path only.
