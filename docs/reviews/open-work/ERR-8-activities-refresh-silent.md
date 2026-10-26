---
severity: minor
category: bug
size: S
triage: ready-for-agent
source: "code review of ERR-4..7 and FIELD-3, 2026-10-26"
blocked_by: []
---
# ERR-8: the Activities tab's focus refresh fails silently

`app/(tabs)/activities.tsx` runs `useFocusEffect(useCallback(() => { void loadActivities() }, …))`,
so a rejected read is an unhandled rejection and the list silently shows stale rows. Its sibling on
the Trails tab and the offline maps list now goes through `src/trails/useRefreshTrailsOnFocus.ts`,
which logs and shows a toast — this is the second instance of that shape.

## Agent Brief

**Category:** bug
**Summary:** The Activities tab's focus refresh logs and tells the user when it fails, through the same hook as the trails refresh.

**Current behavior:**
A `loadActivities` rejection on focus is unhandled; nothing is logged or shown.

**Desired behavior:**
Generalise `useRefreshTrailsOnFocus` into one focus-refresh hook taking the loader and its failure
copy (log phrase, toast text), used by the Trails tab, the offline maps list and the Activities tab.
A failure is logged under `error` and toasted; the list keeps its last rows.

**Key interfaces:**
- `useActivitiesStore`'s `loadActivities(): Promise<void>`, `useTrailsStore`'s `loadTrails()`.
- `src/trails/useRefreshTrailsOnFocus.ts`: replaced by the shared hook, not forked.

**Acceptance criteria:**
- [ ] One focus-refresh hook; no second copy of the log + toast shape.
- [ ] A rejected `loadActivities` on focus logs an error and shows a toast; rows are kept.
- [ ] `docs/architecture/debug-log.md`'s `error` area lists the activities refresh.

**Out of scope:**
- Retry UI.
