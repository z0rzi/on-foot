---
severity:
category: enhancement
size:
triage: needs-triage
source: "owner, tasks.md (moved 2026-10-26)"
blocked_by: []
---
# PROP-18: start from the last camera position

Owner idea. The app starts from the whole-earth view. The map store persists only `mapStyleId` and a
selected trail, no camera — and
`docs/design/specs/2026-08-21-onfoot-rn-restore-last-map-state-design.md` keeps camera position
session-only on purpose ("every launch re-follows the user"), so this revisits a locked decision.
Same root as `PROP-37` (camera reset after saving).
