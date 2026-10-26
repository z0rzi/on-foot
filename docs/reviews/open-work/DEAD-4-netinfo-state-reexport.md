---
severity: minor
category: enhancement
size: S
triage: ready-for-agent
source: "[[2026-09-10-full-review]]"
blocked_by: []
---
# DEAD-4: `NetInfoState` re-export used only by its test

`src/net/netinfo.ts`'s `NetInfoState` re-export is consumed only by its own test; harmless, the
test can import the type from the package directly.

## Agent Brief

**Category:** enhancement
**Summary:** Drop the `NetInfoState` type re-export from the net wrapper.

**Current behavior:**
The net wrapper re-exports `NetInfoState` from `@react-native-community/netinfo`; its only consumer
is the wrapper's own test.

**Desired behavior:**
The re-export is gone. The test imports the type from the package directly; the seam scanner
skips `__tests__` and `*.test.ts`, so this does not breach the `net` seam.

**Key interfaces:**
- `toConnectivityStatus(state)`: unchanged.

**Acceptance criteria:**
- [ ] No `export type { NetInfoState }` remains in the wrapper.
- [ ] The netinfo test still compiles and passes.
- [ ] `npm run verify` is green.

**Out of scope:**
- Any other change to the net wrapper.
