---
severity: minor
category: enhancement
size: M
triage: ready-for-agent
source: "owner, 2026-10-26 (split from PROP-5)"
blocked_by: []
---
# PROP-9: a migration-failure launch leaves no trace in the debug log

The log lives in the SQLite database, so when `useDatabaseMigrations` fails (`app/_layout.tsx:52`)
nothing can be logged; the app shows `Database failed to initialize: <message>` and the next
successful launch has no record of it.

## Comments

> *Commentaire rédigé par un agent IA.*

Arbitrage utilisateur 26/10 → `ready-for-agent`. Gardé. Le mécanisme (où écrire avant que la base existe, comment le rapatrier dans le journal) passe par brainstorm → spec → plan avant tout code.

## Agent Brief

**Category:** enhancement
**Summary:** Design how a migration failure is recorded so it is readable from Settings → Debug log afterwards.

**Desired behavior:**
Write the spec under `docs/design/specs/` with `## Existing shape` (the debug log, `docs/architecture/debug-log.md`)
and `## Failure modes` (the fallback store itself failing, a failure on every launch). Keep the
database seam: SQLite access stays in `src/data/db/`.

**Acceptance criteria:**
- [ ] Spec and plan written; implementation follows the plan.

**Out of scope:**
- Recovering from a failed migration.
