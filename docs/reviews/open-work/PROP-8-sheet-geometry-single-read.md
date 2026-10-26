---
severity: minor
category: enhancement
size: S
triage: ready-for-agent
source: "owner, 2026-10-26 (split from PROP-5)"
blocked_by: []
---
# PROP-8: the sheet-geometry log reads three shared values separately

`src/map/useSheetGeometryLog.ts:28-30` reads `sheetTop.value`, `rootHeight.value` and
`graphBottom.value` one by one from JS, each a separate synchronous trip to the UI thread, once per
app-active transition. Cost is negligible; the point is one consistent snapshot.

## Comments

> *Commentaire rédigé par un agent IA.*

Arbitrage utilisateur 26/10 → `ready-for-agent`. Gardé : regrouper les trois lectures en un seul `runOnUISync`.

## Agent Brief

**Category:** enhancement
**Summary:** The three sheet-geometry values are read in one UI-thread call.

**Acceptance criteria:**
- [ ] One `runOnUISync` (check the installed Reanimated version exposes it) returns all three values.
- [ ] Logged entry unchanged in shape.
- [ ] Device check (owner) listed: entry still appears on app-active.

**Out of scope:**
- When the sample is taken.
