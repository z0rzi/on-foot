# Device-check speed

Spec: [[2026-11-14-device-check-speed-design]]. A device check reads the screen through the Appium
UiAutomator2 server, in a fraction of a second on every screen, and drives with fewer round trips:
a tap that reports what it caused, a read with no screenshot, a step list. Seven items: the reader,
what it unlocks, the commands in the order they build on each other, then the measurement and the
model trial.

| # | Item | Delivers |
| --- | --- | --- |
| 01 | The Appium server reads the screen | Every read through the server, `uiautomator dump` gone, start on demand, stop in `cleanup`, the pinned version, Phone setup |
| 02 | The recording screen and a moving walk are readable | `tap`, `wait-for` and `shot`'s dump while recording and mid-walk; the remembered record button, the pause confirmation and the refusals deleted |
| 03 | `tap` waits for settled and reports what it caused | The settled rule, a tap on a still target, the labels after, `--until`, `--until-gone`, "nothing changed"; commands return their result |
| 04 | `labels`, `back` and `type` | A read with no screenshot; the back key and text entry behind the foreground guard |
| 05 | `do` runs a step list | Several steps in one command, parsed up front, stopped at the first failure |
| 06 | The skill drives with `labels`, `tap --until` and `do`, and the gain is measured | Looking and driving rewritten; one earlier check re-run and set against the original |
| 07 | The model of the check, on trial | The same check on Sonnet; adopted only if the verdicts match |

04 needs only 01 and can be built beside 02 and 03.

## What the build needs beyond the spec

- **The hand run is a reference, not a base.** The spec's Further Notes hold what was measured on
  2026-11-14 and the server calls that worked. No code from that run is kept; write the reader
  from the spec.
- **The two server apps are already on the phone**, v10.6.6, installed on 2026-11-14 and stopped.
  01 records that in Phone setup and does not reinstall unless the version it pins differs.
- **The switch is all at once.** While the server runs, `uiautomator dump` fails immediately, so
  01 lands with every read moved over; there is no state where the two coexist.
- **The server is always started with the argument that leaves accessibility services running.**
  Started without it, it unbinds the owner's own accessibility service for as long as it runs. An
  agent starting the server by hand during the build uses the argument too.
- **The toolkit under change is the toolkit the device check uses.** An item's device
  verification runs the worktree's own launcher, and leaves the phone as the skill's clean-up
  says: no `DEVCHECK` item, the mock off, the server stopped, On Foot on the map.
- **Each item updates the skill lines it makes wrong**, in the same change; 06 rewrites the
  driving guidance as a whole. The skill is written for an agent: follow `writing-for-agents`.
- **No test spawns the toolkit, a fake adb or a fake server.** New decisions are pure functions
  with fixtures captured from the phone, as the toolkit's existing tests are.
- **Claims a device could not confirm** go to `docs/tickets/device-checks.md`.
