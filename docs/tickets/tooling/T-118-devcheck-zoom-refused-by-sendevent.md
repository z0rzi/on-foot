---
severity: should-fix
category: bug
size:
triage:
origin: agent
filed: 2026-11-16
from: "[[2026-11-15-check-hooks-design]]"
blocked_by: []
---
# T-118: `devcheck zoom` cannot pinch on the owner's phone, `sendevent` is refused

In the check-hooks final check of 2026-11-16 (its report, part 2, step 7 and "Other
observations"), `devcheck zoom` failed with `sendevent: /dev/input/event5: Permission denied`.
The node is `crw-rw---- root input` and the shell user is in group `input`, so SELinux is the
likely refusal. `zoom` (`tools/device-check/zoom.ts:17`) writes its pinch as one `adb shell` line
of `sendevent`s (`pinchScript`, `tools/device-check/pinchPlan.ts:33-36`), so it fails before a
finger lands, every time.

The refusal was known before the command existed: the toolkit spec put multi-touch out of scope
because "`sendevent` is refused on this phone" (`docs/design/specs/2026-11-10-device-check-toolkit-design.md:329`),
and `device-checks.md` (Map twist) says the same. `zoom` was added on 2026-11-13 (`c527106`)
and the skill offers it (`.claude/skills/device-check/SKILL.md:176`, `:240`) as if it worked.

What it blocked: draped-route-overlay/01's endpoint dots over the arrows, owed in
`device-checks.md` under the check-hooks entry. At the fitted zoom no arrow reaches an endpoint
(`.scratch/device-checks/2026-11-16/04-climb-ends.png`), so the claim needs a zoom in at each end.

Two ways out, for the owner: drop `zoom` and its skill lines, back to the 2026-11-10 ruling; or
set the camera without touch, through a check hook that zooms the map by the provider port, which
leaves the gesture itself the owner's.
