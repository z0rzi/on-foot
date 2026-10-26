---
severity: minor
category: bug
size: S
triage: ready-for-agent
source: "[[2026-09-10-full-review]]"
blocked_by: []
---
# ERR-5: unhandled picker rejection

`trails.tsx:68-77`'s `pickGpx` is an async `onPress` that can reject (an eslint attribute exemption
hides it), and `:27`'s `void loadTrails()` on focus is the same shape with no failure outcome.

## Agent Brief

**Category:** bug
**Summary:** The Trails tab's GPX picker and its focus reload get a visible failure outcome instead of an unhandled rejection.

**Current behavior:**
On the Trails tab, `pickGpx` awaits `DocumentPicker.getDocumentAsync` as an `onPress` handler; if it
rejects, the rejection is unhandled and nothing is shown. The focus effect calls `void loadTrails()`,
which can reject the same way with no failure outcome.

**Desired behavior:**
A picker rejection is logged via `logEvent` and shown to the user as an alert. A `loadTrails`
failure on focus is logged and leaves the list showing its last known state, with a toast or alert
so the user knows the refresh failed. Follow the existing import-failure pattern (`logEvent` +
`Alert.alert`) rather than inventing a new one.

**Key interfaces:**
- `useTrailsStore`'s `loadTrails(): Promise<void>`.
- The eslint attribute exemption that hides the async `onPress`: remove it once the handler no
  longer leaks a rejection.

**Acceptance criteria:**
- [ ] A rejected picker shows an alert and logs an error; no unhandled rejection.
- [ ] A rejected `loadTrails` on focus logs an error and tells the user; the list keeps its rows.
- [ ] A cancelled pick still does nothing.
- [ ] The eslint exemption on the picker button is gone, or carries a justification.

**Out of scope:**
- The new-trail screen's parse flow (ERR-6).
- Retry UI.
