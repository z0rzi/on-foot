---
severity: minor
category: bug
size: S
triage: ready-for-agent
source: "[[2026-09-10-full-review]]"
blocked_by: []
---
# FIELD-3: the interruption toast is hidden, and its range overstates the gap

The toast fires behind the splash, and its range starts at the last stored point rather than the
gap's real start. The debug log records the announced range, so a fix can be checked against real
field data instead of a guess.

## Comments

> *Commentaire rédigé par un agent IA.*

Arbitrage utilisateur 26/10 → `ready-for-agent`. La plage garde le dernier point enregistré comme début, mais le texte devient « No position between HH:MM and HH:MM » (les toasts de l'app sont en anglais) : il dit ce qui manque, pas l'heure de la mort. Le toast reste un toast court, lancé une fois la carte visible plutôt que sous le splash. Hors périmètre : l'heure exacte du kill (exit-info natif), un bandeau persistant.

## Agent Brief

**Category:** bug
**Summary:** The relaunch-after-death toast says what is missing, and is shown once the map is visible.

**Current behavior:**
`resumeAfterProcessDeath` (`src/recording/recordingController.ts`) calls
`showToast("Recording interrupted <since>–<now>")` during launch, while the splash still covers the
map, so the toast is not seen. `since` is the last stored point, which for a stationary user
(`minDistanceM: 10`) predates the death by minutes, so "interrupted" overstates the gap.

**Desired behavior:**
Same range (last stored point, or `session.startedAt` with no points, to relaunch time), worded
`No position between HH:MM and HH:MM`. The toast fires once the map is
on screen (after the splash hides), not inside the resume chain. The `announced an interruption`
log entry stays.

**Key interfaces:**
- `resumeAfterProcessDeath`, `showToast` (`src/components/toast.ts`), `expo-splash-screen`.
- The message text is a pure function of `(since, now)`: TDD it.

**Acceptance criteria:**
- [ ] Message wording tested as a pure function.
- [ ] Toast deferred until the map is visible; the deferral mechanism is not a timer guess.
- [ ] Device check (owner): kill mid-recording, relaunch, toast is seen. Listed in pending device checks.

**Out of scope:**
- Exact kill time via Android exit-info.
- A persistent in-app banner.
