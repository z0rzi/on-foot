---
severity: minor
category: enhancement
size: S
triage: ready-for-agent
source: owner, 2026-10-11
blocked_by: []
---
# PROP-1: `OfflineBadgeState` is misnamed

The type drives the badge, the downloading progress block *and* the ⋮ menu in `TrailInfoSheet`;
"badge" names one of three. Rename to `TrailOfflineStatus`, `offlineStateForTrail` →
`offlineStatusForTrail`, `badge.ts` → `status.ts`. Touches `offline/types.ts`, `badge.ts`,
`menu.ts`, `TrailInfoSheet.tsx` and two tests; no behaviour. Deliberately kept out of row 10, which
is deletions.

## Agent Brief

**Category:** enhancement
**Summary:** Rename `OfflineBadgeState` to `TrailOfflineStatus` and its helpers to match, with no behaviour change.

**Current behavior:**
`OfflineBadgeState` drives the offline badge, the downloading progress block and the ⋮ menu in the
trail info sheet, but its name mentions only the badge.

**Desired behavior:**
`OfflineBadgeState` → `TrailOfflineStatus`; `offlineStateForTrail` → `offlineStatusForTrail`; the
module that defines it is renamed from `badge` to `status`, and its test follows. Every consumer is
updated.

**Key interfaces:**
- `TrailOfflineStatus` (formerly `OfflineBadgeState`).
- `offlineStatusForTrail` (formerly `offlineStateForTrail`).

**Acceptance criteria:**
- [ ] No occurrence of `OfflineBadgeState` or `offlineStateForTrail` remains in `src/` or `app/`.
- [ ] The offline module and its test are named `status`.
- [ ] `npm run verify` is green; no test changed except for names.

**Out of scope:**
- Any change to the union's members or to the UI.
