# Device-check planning

Spec: [[2026-11-15-device-check-planning-design]]. A plan's device criteria live in one final
check, which the plan-items gate holds; a check plan keeps only claims the device must answer, each
with its cheapest evidence, and the device-check agent runs the plan and no more. Two items, no
blocker between them. Nothing here needs the phone, so the plan has no final check of its own.

| # | Item | Delivers |
| --- | --- | --- |
| 01 | The plan-items gate holds the final-check shape | The `final_check` key and the `Device:` rules in the gate, test-first; the plan conventions and `AGENTS.md` saying the same |
| 02 | The check plan earns each claim, and the agent runs only the plan | `BRIEF.md`'s per-claim reason and cheapest evidence, the wait total, owed entries, re-check briefs; the skill's scope rule |

01 and 02 have no blocker and can be built at the same time.

## What the build needs beyond the spec

- **No item touches the phone**: no `devcheck` command, no `adb`, no build for the device.
- **The check-hooks plan breaks the gate once 01 is on master.** It is in flight on its own
  integration branch, in another session; this plan does not edit it. Whoever next merges master
  into `check-hooks` moves the `Device:` lines of its items into its last item, marks that item
  `final_check: true`, and recovers item 02's line ("the launch line of a clean build and of a
  dirty one, and the verdict for each") from git (`803f19b`).
- **02 collides with check-hooks item 10**, which rewrites `SKILL.md` and `BRIEF.md` around hooks.
  Whichever lands second writes its part on top of the other; neither reverts the other's lines.
- **Skill text follows `writing-for-agents`**, and a brief points at the skill rather than
  restating its rules.
