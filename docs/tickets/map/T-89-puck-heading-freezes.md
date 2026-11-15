---
severity: investigate
category: bug
size:
triage:
origin: owner
filed: 2026-11-09
from: "field notes, hike of 2026-11-08"
blocked_by: []
---
# T-89: the puck's direction freezes until the app restarts

Seen by the owner on a hike, more than once: the puck's direction arrow stops turning and stays on
one bearing while the position keeps moving. Restarting the app fixes it. When it starts (after
the screen goes off, a background and resume, a relaunch mid-recording) is not known.

The arrow's rotation never goes through JS: `UserPuck` (`src/map/providers/mapbox/adapter.tsx`)
sets `puckBearing="heading"`, so Mapbox's native location component reads the compass itself.
The debug log cannot see the freeze today. First step: log enough to catch it next time, e.g. the
puck's mounts and unmounts, app state changes, and a heading signal JS can read, sampled and
logged when it stops changing while the position moves. Where that signal comes from (rnmapbox's
user-location updates, or the location port) is to be checked; reading the compass belongs to the
location seam. No coordinates in the log.

The hike's debug log (2026-11-08, exported 2026-11-09, not kept in the repo) has no relaunch
between the recording's start at 12:49 and four cold starts in a row at 17:24:08–17:24:33. If the
restart that fixed the freeze was on this hike, it is one of those, and the freeze began before
17:24. Nothing in the log shows the freeze itself.

Since 2026-11-11 the debug log has the signal ([[2026-11-11-field-diagnostics-design]], §3), not
yet seen on a device. While a recording is in the recording phase and the app is in front, a
second watch on the compass, through the location port, writes `map heading watch` when it starts
and stops, `map heading sample` every five minutes (`updates`, `spreadDeg`, `accuracy`,
`movedM`), and `map heading stalled` when the compass has been silent for at least 60 s over
which the recording moved 50 m, then `map heading resumed` on its next reading. The puck writes `map puck mounted` and `map puck unmounted`.
On the next frozen arrow, note the time and read the entries around it. Samples with `updates`
and `spreadDeg` well above zero and no `heading stalled` say the phone's compass kept turning:
the freeze is inside Mapbox's location component, and the fix is on the map side (remount the
puck, or drive its bearing from the port). A `heading stalled` at that time says the sensor or
the OS stopped delivering, and the map is not the cause. A `puck unmounted` then `puck mounted`,
or an `app active`, just before the freeze names what it follows. Two limits: the log never sees
the drawn arrow itself, and Android sends a reading only on a turn of about 2°, so a phone held
perfectly steady on a straight line also reads as a stall.

## Comments

> *Comment written by an AI agent.*

Two device checks of the signal give different readings of a phone lying still on the desk, under
a mock walk. On 2026-11-11: `heading sample {"updates":14,"spreadDeg":2.6,…}` and one
`heading stalled {"silentS":64,"movedM":78}`. On 2026-11-14 (build `c7f942b`):
`heading sample {"updates":627,"spreadDeg":11.3,…}` over five minutes and no stall, with nothing
showing the phone was handled. So a still phone does not always go silent: its compass can send
about two readings a second over an 11° arc. Read a field sample with `updates` and `spreadDeg`
well above zero as "the compass kept reporting", which may be noise. It is not proof that the
phone turned.
