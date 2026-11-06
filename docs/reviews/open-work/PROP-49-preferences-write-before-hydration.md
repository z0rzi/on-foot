---
severity: minor
category: bug
size: S
triage: ready-for-agent
source: "agent, 2026-11-02 (IDEA-18 review follow-up)"
blocked_by: []
---
# PROP-49: a preference change before or after a failed hydration overwrites the stored preferences

`usePreferencesStore` (`src/settings/preferencesStore.ts`) persists through zustand `persist` with a
plain `createJSONStorage(() => AsyncStorage)`. zustand writes the whole `partialize`d state on every
`set`, whether or not the read has landed. So a toggle made while the read is pending, or at any
time after it failed (AsyncStorage error, corrupt payload), writes the in-memory defaults for the two
other preferences over what storage held. Today only a user action sets this store, so the window
is a tap on the pace/speed toggle or a Settings change in the first moments of a launch, or any
change in a session whose read failed.

The map store had the same defect and was fixed on the `IDEA-18` branch by
`src/store/writesAfterHydration.ts`, a storage wrapper that drops `setItem` until the store reports
`persist.hasHydrated()` (tests in `src/store/__tests__/mapStore.test.ts`, "nothing is written").
This is its second instance.

## Agent Brief

**Category:** bug
**Summary:** The preferences store writes nothing to storage until its own hydration has completed.

**Current behavior:**
A `set` before hydration completes, or after it failed, persists the defaults of every preference
the user did not just change.

**Desired behavior:**
The preferences store uses `writesAfterHydration` the way the map store does; storage keeps what it
held until a hydration has landed. A change made before that still applies in memory for the session.

**Acceptance criteria:**
- [ ] A test, red first: a failed hydration followed by a preference change writes nothing; a
      pending hydration followed by a change writes nothing until it lands.
- [ ] `npm run verify` green.

**Out of scope:**
- A launch gate or splash hold for this store; nothing renders wrongly on the defaults.
- Self-healing a corrupt payload.
