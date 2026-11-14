---
severity: should-fix
category: refactor
size: M
triage: ready-for-agent
origin: agent
filed: 2026-11-14
from: "ARCH-1 in [[2026-11-14-full-review]]"
blocked_by: []
---
# T-103: `mapStore.ts` holds five jobs in 402 lines

`src/store/mapStore.ts` mixes camera-follow policy (`nextFollowMode`, `demoteBearing`,
`nextPitchOnToggle`, `clampPitch`, `normalizeDeg`, `shouldShowNorthButton`, `pitchForFollowMode`,
`followModeChange`, `followCameraProps`, `manualPitchProps`, `:10-116`), style switching
(`StyleChoice`, `satelliteToggleTarget`, `resolveQuickSwitch`, `:118-146`), the map-mode derivation
and selection model (`MapMode`, `Selection`, `mapMode`, `trailToShow`, `PendingFit`, `:148-183`)
and the persisted store (`:185-402`). 11 of its exports are exempted from the unused-export gate
only because their tests import them (`src/architecture/unusedExports.ts`, the `mapStore.ts`
entries under `PRE_EXISTING`).

`AGENTS.md`: a file that outgrows one clear job is a signal to decompose. Today every camera change
reopens the selection store. T-87 (North and 3D keep follow) will change the follow helpers, so
this is a prefactor for it.

## Agent Brief

**Category:** refactor
**Summary:** Move the pure camera-follow and style-switch helpers out of `mapStore.ts`, with their
tests. Behaviour does not change.

**Desired behavior:**
- The follow-camera helpers live in a module of their own under `src/map/`, and the style-switch
  helpers in another. The store keeps state, actions and persistence, and imports them.
- Their tests move with them. A helper that is a test seam gets the gate's honest rationale, or no
  exemption once the module's public surface covers it. That clears the `mapStore` group of T-102.
- Callers import from the new modules, not through re-exports from the store.
- Where the map-mode and selection types go is the worker's call, written in the commit: they stay
  in the store, or move next to the selection hooks. Moving them is optional.

**Acceptance criteria:**
- [ ] `mapStore.ts` holds the store, its state types and persistence, plus whatever the worker
      decided for map mode and selection.
- [ ] No `PRE_EXISTING` exemption is left for an export that moved.
- [ ] Persisted keys and `partialize` unchanged: no change in what survives a restart.
- [ ] `npm run verify` green.

**Out of scope:**
- Changing follow behaviour (T-87).
- The two `AsyncStorage` stores and the persisted-preferences wrapper candidate (`seams.md`).
