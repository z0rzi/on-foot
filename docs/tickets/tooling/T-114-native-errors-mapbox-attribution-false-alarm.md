---
severity: minor
category: bug
size: S
triage:
origin: agent
filed: 2026-11-15
from: "device check of the logcat mirror, 2026-11-15"
blocked_by: []
---
# T-114: `native-errors` reports Mapbox's attribution warning as a source or layer error

Every launch logs, twice, `W Mapbox: [maps-android\MbxAttribution]: Attribution must be enabled
if you use data from sources that require it`. `kindOf` (`tools/device-check/logcatErrors.ts:14`)
takes a Mapbox warning for a style error when it matches `/\b(source|layer)s?\b/`, and "sources"
in that sentence matches, so `devcheck native-errors` exits 1 on a clean launch and lists the two
lines under "Mapbox style, layer and source errors". Seen in both device checks of 2026-11-15. A
check then has to read past a failure that is not one, which is how a real one gets read past too.
