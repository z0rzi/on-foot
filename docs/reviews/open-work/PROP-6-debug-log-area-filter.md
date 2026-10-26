---
severity: minor
category: enhancement
size: S
triage: ready-for-agent
source: "owner, 2026-10-26 (split from PROP-5)"
blocked_by: []
---
# PROP-6: the debug log viewer has no area filter

`fix batch` entries (area `capture`, written per GPS batch by `src/recording/locationTask.ts:26`)
are ~95% of the log's volume, so a rare `launch` or `recording` entry is hard to find in
Settings → Debug log (`src/log/LogList.tsx`).

## Comments

> *Commentaire rédigé par un agent IA.*

Arbitrage utilisateur 26/10 → `ready-for-agent`. Un sélecteur de zones (puces multi-sélection), pas un simple interrupteur « masquer fix batch ».

## Agent Brief

**Category:** enhancement
**Summary:** Settings → Debug log gets area chips to filter which entries are listed.

**Desired behavior:**
One chip per `LogArea`, multi-select, all on by default; the list shows entries whose area is on.
Filter state is session UI state, not persisted. The share/export keeps exporting every entry.
Follow an existing chip/segmented control in the app if there is one.

**Acceptance criteria:**
- [ ] Filtering logic is a pure function, tested first.
- [ ] Turning `capture` off leaves only non-capture entries.
- [ ] Export unaffected by the filter.

**Out of scope:**
- Text search, level filter.
