---
severity:
category: enhancement
size:
triage: ready-for-agent
source: owner, 2026-10-07
blocked_by: []
---
# IDEA-4: progressive route rendering

Proposed after measuring a 13.3 km trail selection at 657 ms of frame activity. Show the trace on
the map immediately as a plain line, then let the profile, the slope colours and the elevation
graph arrive a beat later. It works because Mapbox draws on the native thread: once JS hands over
the plain coordinates the map can paint while JS is still deriving. `useRouteDisplay` is now the
one place that derives the profile, so deferring it is one change and everything downstream
appears together. Likely idiom: `useDeferredValue(segments, null)` (the two-argument form is
present in React 19.2.3's types — checked).

**Measure before designing**: the 657 ms is at least two costs — the `JSON.parse` of the whole
track, which deferral cannot help, and the profile/banding arithmetic, which it can. The split is
unknown, and if the parse dominates this buys less than it looks; `useRouteDisplay` is now the
single place to instrument that.

**Open design question**: on a short route the derivation is already fast, so deferring could add
a flicker where today it is instant — probably wants a size threshold, which needs its own device
verification. Gets its own spec.

## Comments

> *Comment written by an AI agent.*

Owner ruling 26/10 → `ready-for-agent`. Step 1 only: an agent writes to the debug log the duration of the track's `JSON.parse` and that of the profile/banding computation, separately. The owner will then select a long trail and read the log; the ticket then goes back to `ready-for-human` to decide whether it is worth a spec. No `useDeferredValue` and no spec before the number.

## Agent Brief

**Category:** enhancement
**Summary:** Log how a trail selection's cost splits between parsing the track and deriving the profile.

**Current behavior:**
A 13.3 km trail selection measured 657 ms of frame activity; the split between the track's
`JSON.parse` and `routeDisplay`'s profile/banding arithmetic (`src/map/useRouteDisplay.ts`) is unknown.

**Desired behavior:**
One `logEvent('info', …)` per selection carrying both durations in ms and the point count — never
coordinates (`docs/architecture/debug-log.md`). Instrument where each cost actually runs; find
where the track is parsed rather than assuming `useRouteDisplay`.

**Acceptance criteria:**
- [ ] Selecting a trail writes one entry with parse ms, derivation ms, point count.
- [ ] No coordinate in the entry.
- [ ] On completion set `triage: ready-for-human` with a comment: owner selects a long trail and reads the entry.

**Out of scope:**
- Any deferral, threshold or spec.
