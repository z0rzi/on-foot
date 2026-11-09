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
