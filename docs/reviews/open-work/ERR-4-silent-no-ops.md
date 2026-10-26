---
severity: minor
category: bug
size: S
triage: ready-for-agent
source: "[[2026-09-10-full-review]]"
blocked_by: []
---
# ERR-4: silent no-ops

Tapping an activity during a recording returns with no feedback; a failed offline-registry `init`
leaves the settings list saying "No offline maps yet" until the app restarts, because
`OfflineMapsList` reloads trails on focus but never re-`init`s.

## Agent Brief

**Category:** bug
**Summary:** Two silent no-ops get feedback: tapping an activity while recording, and a failed offline-registry init.

**Current behavior:**
1. On the Activities tab, tapping an activity while `recordingPhase(session) !== 'idle'` returns
   with no feedback.
2. The offline store's `init(controller)` is called once at app start with its failure swallowed.
   If it fails, the Settings offline list says "No offline maps yet" until restart, because the
   list reloads trails on focus but never re-runs `init`.

**Desired behavior:**
1. The tap shows a toast (`showToast`) explaining that activities cannot be opened while
   recording.
2. Opening the offline maps list re-runs the offline store's pack reload on focus, so a failed
   start-up init recovers without a restart. A failure of that reload is logged with `logEvent`.

**Key interfaces:**
- `recordingPhase()` and the recording store: read only.
- The offline store's `init(controller)` (or the `reload` it wraps): called from the list's focus
  effect.

**Acceptance criteria:**
- [ ] Tapping an activity during a recording shows a toast and does not navigate.
- [ ] Tapping an activity when idle behaves as today.
- [ ] Focusing the offline list reloads packs; a pack registered after a failed init appears.
- [ ] A reload failure is logged, not thrown.

**Out of scope:**
- Allowing activities to be opened during a recording.
- Changing the app-start `init` call.
