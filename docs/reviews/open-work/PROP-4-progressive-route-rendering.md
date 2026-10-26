---
severity:
category: enhancement
size:
triage: ready-for-human
source: owner, 2026-10-07
blocked_by: []
---
# PROP-4: progressive route rendering

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

## Why a human

Starts with a device measurement: how much of the 657 ms is `JSON.parse` and how much is the
profile/banding arithmetic. The answer decides whether deferral is worth it and what size threshold
to use, then it goes brainstorm → spec → plan.
