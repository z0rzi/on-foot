---
severity:
category: enhancement
size:
triage: ready-for-human
origin: owner
filed: 2026-10-07
from:
blocked_by: []
---
# T-4: progressive route rendering

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

> *Comment written by an AI agent.*

Step 1 built, 11/11 ([[2026-11-11-field-diagnostics-design]], §1) → `ready-for-human`. Two entries, each `{ kind, points, ms }`: `map route loaded`, the load of the selected trail or activity (the SQLite read and the `JSON.parse` together, both blocking JS), and `map route derived`, the profile and banding pass. The parse is not timed alone: that would put the log inside the database seam. The owner selects a long trail, opens Settings → Debug log and reads the two `ms` side by side. Not yet seen on a device.

## Why a human

The number decides. If `route loaded` carries most of the 657 ms, deferring the derivation buys
little and this closes or turns into a lighter stored geometry; if `route derived` does, it is
worth a spec, with the size threshold as its open question. Only the owner's phone and the owner's
long trail give the figure, and the call on what it is worth is theirs.
