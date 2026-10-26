---
severity: should-fix
category: bug
size: S
triage: ready-for-agent
source: "[[2026-09-10-full-review]]"
blocked_by: []
---
# ERR-6: `metricsForSegments` runs outside the surrounding `try`

`app/trail/new.tsx:50` sits after the `try`/`catch` at `:33-47` closes, so a throw there is an
unhandled rejection behind a spinner that never exits — `ERR-3`'s defect class, in a file the
loaded-entity work touched. Deliberately not folded into that `try`: it would report "Not a GPX
file" for something that is not a parse failure. Fix: a third outcome in the same effect.

## Agent Brief

**Category:** bug
**Summary:** A throw from `metricsForSegments` on the new-trail screen gets its own visible failure outcome instead of an endless spinner.

**Current behavior:**
On the new-trail screen, the effect reads and parses the GPX inside a `try`/`catch`, then calls
`metricsForSegments(parsed.segments)` after the `catch` closes. A throw there is an unhandled
rejection, and the screen stays on its loading spinner forever.

**Desired behavior:**
A throw from the metrics step is caught as a third outcome, separate from the parse failure: it is
logged with `logEvent('error', …)`, the user sees an alert that does not claim the file is not GPX,
and the screen leaves the same way the parse failure does. The parse-failure path is unchanged.

**Key interfaces:**
- `metricsForSegments(segments)`: unchanged.
- `classifyGpxFailure` / `gpxImportAlert`: must not be reused to report this as a parse failure;
  extend them with a distinct outcome if that is the cleanest home.

**Acceptance criteria:**
- [ ] A metrics throw shows an alert, logs an error, and leaves the screen; no spinner remains.
- [ ] The alert text does not say "Not a GPX file".
- [ ] A cancelled effect (screen unmounted) shows nothing.
- [ ] Any new pure mapping (failure kind → alert) is unit-tested.

**Out of scope:**
- Changing parse-failure classification or its messages.
- Making `metricsForSegments` itself throw less.
