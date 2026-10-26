---
severity: minor
category: enhancement
size: S
triage: ready-for-agent
source: "owner, 2026-10-26 (split from PROP-5)"
blocked_by: []
---
# PROP-7: `src/log/index.ts` is a half-barrel five consumers bypass

`src/log/index.ts` exports only `logEvent` and the log types, while `deviceInfo`
(`src/recording/useResumeRecording.ts:5`), `fixBatchSummary` (`src/recording/locationTask.ts:4`),
`LogList` (`app/settings/log.tsx:3`), `useLogRetention` and `installGlobalErrorHandler`
(`app/_layout.tsx:17-18`) are imported by path.

## Comments

> *Commentaire rédigé par un agent IA.*

Arbitrage utilisateur 26/10 → `ready-for-agent`. `index.ts` devient l'unique point d'entrée public de `src/log` ; on ne le supprime pas.

## Agent Brief

**Category:** enhancement
**Summary:** Every import of `src/log` from outside the folder goes through `src/log/index.ts`.

**Acceptance criteria:**
- [ ] `index.ts` exports what outside consumers use; no outside import reaches into `src/log/<file>`.
- [ ] Enforced by a test or lint rule, the way other module boundaries are (check `src/architecture/` first).
- [ ] No import cycle introduced (`npm run verify` cycles test).

**Out of scope:**
- `src/data/log/` (the repository side).
