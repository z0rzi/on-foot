---
status: open
blocked_by: []
closes: []
---
# 01: the lists read only their columns, and the stores load at launch

**What to build:** prefactor for the overview (spec D122). The Trails and Activities lists, the
offline list and the personal factor's history read at record start get their rows from a read
that selects only the columns they show, never a row's full geometry, as the spec that introduced
the summaries said. The trails and activities stores load once the database migrations have run,
at launch, not only when a list gains focus, so the map can rely on them. A reload of either store
is latest-wins: when two loads overlap (a trail deletion bumps both stores back to back), the later
one is what the store keeps. Nothing visible changes for the owner.

- [ ] The list reads select their columns; no list read touches the geometry column (a test on the
      repository's query shape or on the mapping proves it)
- [ ] Both stores are loaded after the migrations at launch; the lists still refresh on focus as
      today
- [ ] Two overlapping reloads of a store end with the later one's rows (test fails before, passes
      after)
- [ ] Record start's history read no longer loads unrelated full geometries beyond what the
      personal factor needs
- [ ] `npm run verify` green
