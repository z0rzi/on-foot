# Device-check planning: one check per plan, claims only a device can answer — Design

**Status:** Built, [[2026-11-15-device-check-planning]].
**From:** the owner's question of 2026-11-15 ("maybe the agents are just planning their checks very
badly … if I did the checks myself, it would take 5 minutes, maybe 10 minutes"), the owner's order
of the same day ("Do only one final device check, don't let each worker do their own device
check"), and a read of every device-check transcript from 2026-11-06 to 2026-11-15. Follows
[[2026-11-14-device-check-speed-design]], which left walk time out of its problem, and runs beside
[[2026-11-15-check-hooks-design]], which takes setup and teardown off the screen.
**Date:** 2026-11-15

Terms are the toolkit specs' (a **device check** is a run of the `device-check` skill, the
**caller** dispatches it, a **check plan** is the brief's list of claims). New here: a **device
criterion** is a plan item's acceptance line that only the phone can tick; the **final check** is
the one plan item that holds a plan's device criteria and runs them; a **claim-set wait** is time
a claim makes the agent wait on the clock (a walk at `walk` pace, a timer, a stretch dead or in
the background).

## Problem Statement

The device-check work so far made each step on the phone faster: a reader that does not wait for
idle, `tap --until`, `do`, the capture. Device checks are still slow, and the owner, who would
check the same change by hand in five to ten minutes, waits an hour or more on the agents.

The transcripts of 2026-11-06 to 2026-11-15 hold 29 runs that drove the phone across seven
efforts, about 20 hours of agent time. Where it went:

| | share |
| --- | --- |
| Model turns between steps | 31 % |
| Sleeps and polling loops on a walk, a log line or a timer | 28 % |
| Taps, reads and screenshots on the phone | 20 % |
| Host commands | 7 % |
| Walks in the foreground | 6 % |
| Recovering a phone that dropped off | 4 % |
| Reading code and docs | 2 % |

The phone itself is a fifth of it. The rest is set by what the checks were asked to do:

- **Every plan item checks itself, then the last item checks it all again.** The
  recording-survives-process-death plan wrote "Device check on a release build of this item" into
  items 01, 02 and 03. Each built a release, ran its own check and passed with no defect. Item 04
  then ran the same steps on the integrated build because the earlier evidence "was per-item", and
  a fifth build and run finished what 04 could not. Five runs, five builds, about 300 minutes;
  about 75 of them repeated by 04. Hiking-ux took six runs and eight builds, each paying the
  skill read, the build, the test data and the clean-up again.
- **A plan's device criteria get lost.** Check-hooks lists a `Device:` line in each item and leaves
  it unticked for a final check, as the owner ordered. An item's file is deleted when it lands, so
  item 02's device line ("the launch line of a clean build and of a dirty one") left the plan with
  the file, and the plan's last item does not list it.
- **Claims wait on the clock for what a test already holds.** The walking-time-ahead check spent
  about 50 minutes walking 2.4 km `DEVCHECK` activities to build a personal-factor history whose
  arithmetic the Jest suite already covers. Across every transcript, 442 minutes were spent
  blocked in polling loops and 103 in sleeps of 20 s or more; `walk` pace was chosen 263 times,
  `fast` 88.
- **Claims multiply into matrices.** Briefs ask for light and dark, each map layer, font scale
  1.3, airplane mode on each layer, whether or not the claim is about the theme, the layer or the
  scale.
- **Agents add variants nobody asked for.** The re-run of 2026-11-14 "did more" than the check it
  repeated (a second T-95 variant, two extra kills and relaunches) and took 112 turns against 48.

A step costs an agent about 4 to 5 s of model time, and a run takes 100 to 300 steps: 15 to 40
minutes before a single wait, with a perfect toolkit. A glance costs the owner a second. The lever
left is the number of runs and the number and shape of claims, not the speed of a step.

## Solution

- **One device check per plan, at its end, on the integrated build.** A plan's device criteria
  live in one item, the final check, which every other item blocks. Workers on the other items do
  no device work: no build for the phone, no install, no check.
- **The plan-items gate holds the shape.** A plan with any device criterion has exactly one final
  check, last in its order, and no device criterion outside it.
- **A claim earns its place in a check plan.** Each claim says what only the device can show
  (rendering, OS and lifecycle behaviour, a native module, what survives a kill). Logic the Jest
  suite holds is at most read once, in a state the check reaches anyway, never built up on the
  phone in real time.
- **Each claim takes its cheapest evidence.** `fast` pace or a jump unless the claim reads pace;
  the shortest dead or background stretch that still shows the behaviour; one theme, one layer and
  one font scale unless the claim is about them.
- **The plan states its claim-set waits** and their total, so the caller sees the cost before
  dispatching.
- **The agent runs the plan, not more.** A variant it thinks worth running goes in its report as a
  suggestion, unrun.
- **A defect found by the final check is re-checked narrowly**: the failed claims and the claims
  the fix can touch, on one new build, not the whole list again.
- **Owed claims ride along.** When a check is dispatched, the caller adds the owed entries of
  `docs/tickets/device-checks.md` that the same build reaches, rather than leaving them for a run
  of their own.

## User Stories

1. As the owner, I want one device check per plan, so that a plan costs one build and one run on the phone, not one per item.
2. As the owner, I want a device check of a plan to take tens of minutes, not hours, so that I stop deferring checks into `docs/tickets/device-checks.md`.
3. As the owner, I want the agents' checks to be closer to the five or ten minutes I would spend, so that I can trust them with the checking.
4. As the owner, I want a check plan to show its claim-set waits before it is dispatched, so that I see where an hour would go and can cut it.
5. As the owner, I want claims that only repeat a unit test kept off the phone, so that the phone's time goes to what only the phone can show.
6. As the owner, I want a walk at `walk` pace only when the claim reads pace, so that a puck or camera claim does not cost a real-time walk.
7. As the owner, I want a light-and-dark or every-layer pass only for a claim about the theme or the layer, so that one look is not multiplied by the matrix.
8. As the owner, I want the agent to run the claims it was given and suggest the rest, so that a check ends when its plan does.
9. As the owner, I want a defect found by the final check re-checked on its own claims, so that one fix does not cost the whole check again.
10. As the owner, I want owed device claims folded into the next check whose build reaches them, so that they do not wait for a run of their own.
11. As the owner, I want feel still marked `owner to verify`, so that a faster check never claims a gesture or an animation on my behalf.
12. As a planning agent breaking a spec into items, I want one place for every device criterion, so that I write each one once, in the final check.
13. As a planning agent, I want the gate to tell me when a device criterion sits outside the final check, so that the plan's shape is right before any worker starts.
14. As a planning agent, I want the gate to tell me when the final check is not last, so that it never runs on a build missing an item.
15. As a planning agent, I want a plan with no device criterion to need no final check, so that a docs or tooling plan carries no empty item.
16. As a worker on an item, I want to know my item does no device work, so that I do not queue on the single shared phone or start a 20-minute build.
17. As a worker on an item whose change needs the device to confirm, I want to hand its device criterion to the final check, so that it is not lost when my item's file is deleted.
18. As the agent writing the final check's brief, I want every device criterion of the plan in one file, so that the check plan is a copy of it in run order.
19. As the agent writing a check plan, I want to name for each claim why it needs the device, so that a claim with no answer is dropped before it costs time.
20. As the agent writing a check plan, I want to name each claim's cheapest evidence (pace, jump, wait length, theme), so that the device-check agent does not pick the expensive one.
21. As the agent writing a check plan, I want to total its claim-set waits, so that a long wait is visible and can run in the background while other claims run on the phone.
22. As the device-check agent, I want the skill to say that a variant beyond the plan is a suggestion in the report, so that I know the scope I am held to.
23. As the device-check agent, I want a claim that reads a pure result to be read in a state the check already reaches, so that I do not build history at walking speed.
24. As the device-check agent, I want a re-check brief to list only the claims to run again, so that I do not rebuild the whole list after a fix.
25. As the device-check agent, I want a phone that drops off to leave the unrun claims `blocked` in my report, so that the caller re-dispatches only those.
26. As the caller after a final check, I want the claims a device could not confirm moved to `docs/tickets/device-checks.md`, so that closing the final check loses none of them.
27. As a reviewer of a plan, I want the final check to name every item it covers, so that I can see each item's device criteria reached the end.
28. As a future agent, I want the rule written in the plan conventions and the gate, not only in a memory, so that it holds for every agent and every session.

## Implementation Decisions

- **The final check is a plan item like any other**, numbered last, with one new frontmatter key,
  `final_check: true`. Its body lists the plan's device criteria grouped by the item they come
  from (a heading or a bold lead per item), then the check plan's other parts the caller needs
  (the claim-set waits, the owner's feel items). Every other key keeps its meaning; an item
  without the key reads as `final_check: false`.
- **A device criterion is a checkbox line whose text starts `Device:`** (`- [ ] Device: …`), the
  form check-hooks already uses. A line that mentions the device in another sense (a criterion
  about the `device-check` skill, the toolkit) is not one, so the prefix is the colon form only.
- **The gate's rules, per plan folder, when any item holds a device criterion:**
  - exactly one item has `final_check: true`;
  - no device criterion sits in an item without `final_check: true`;
  - every other open item reaches the final check through `blocked_by` (directly, or through items
    that do), and no item lists the final check in its `blocked_by`;
  - an item with `final_check: true` and no device criterion is flagged: the key is for the one
    item that runs the phone.
  A plan with no device criterion and no `final_check` item passes. A built plan, `plan.md` alone,
  passes. The new key joins the gate's key list and enum check (`true` | `false`).
- **The gate is the existing plan-items check**, extended in its pure function over item files;
  the device-criterion and reachability rules reuse the frontmatter, link and key helpers it
  shares with the ticket check. No new seam.
- **The plan conventions** (the issue tracker's "Plan work items" section and its `/to-tickets`
  section) say: device criteria live only in the final check; a worker on another item does no
  device work; the final check is dispatched once, after the plan's last code review, with a check
  plan copied from it; a defect it finds is fixed by an item or a fix on the integration branch,
  then re-checked on its own claims and the claims the fix can touch.
- **`AGENTS.md`'s device-verification line** gains that a plan's device verification is its final
  check, once, at its end.
- **The check plan (`BRIEF.md`)** gains, per claim: why only the device can show it (rendering, OS
  or lifecycle behaviour, a native module, persistence across a kill; a claim answered by the Jest
  suite is dropped or read once in a state the check reaches anyway); its cheapest evidence (pace,
  jump, wait length, one theme or layer unless the claim is about it). The plan as a whole gains
  its claim-set waits with their total, and the owed entries of `docs/tickets/device-checks.md`
  the same build reaches. A re-check brief lists only the claims to run again.
- **The `device-check` skill**, in its list and run steps: the brief's claims are the scope; a
  variant the agent thinks worth running goes in the report under **Other observations** as a
  suggestion, unrun. This is a rule of the skill, not of the brief, since the skill's rules hold
  over any brief.
- **The owner's order of 2026-11-15, kept until now in an agent memory,** moves into the repo:
  its conventions and gate become the place agents read it from.

## Testing Decisions

- A good test feeds the gate's pure function a set of item files and reads the problems it
  reports, as the existing plan-items tests do: fixtures built in the test, no reads of the real
  plans except the one test that runs the gate over `docs/design/plans`.
- Tested, test-first, in the plan-items test:
  - a plan with device criteria only in its `final_check` item, blocked by every other item,
    passes;
  - a device criterion in an item without the key is flagged, naming the item;
  - two `final_check` items in one plan are flagged; one each in two plans is not;
  - a plan with device criteria and no `final_check` item is flagged;
  - an open item that does not reach the final check through `blocked_by` is flagged, and one that
    reaches it through another item is not;
  - an item blocked by the final check is flagged;
  - a `final_check` item with no device criterion is flagged;
  - `final_check` with a value other than `true` or `false` is flagged;
  - a criterion that mentions the `device-check` skill without the `Device:` prefix is not a
    device criterion;
  - a plan with no device criterion and no `final_check` item passes, and so does `plan.md` alone.
- Prior art: the plan-items test's fixture builders (`plan()`, `item()` with frontmatter
  overrides) and its `blocked_by` resolution cases; the ticket gate's shared core.
- The guidance (the check plan, the skill, the plan conventions) has nothing a test can hold. It
  is reviewed by `/code-review` against this spec, and its effect is read from the next plan's
  final check: runs, builds, turns and wall time, set against the recording-survives-process-death
  figures above.

## Existing shape

- **The check plan** of [[2026-11-14-device-check-speed-design]] (`BRIEF.md`) is the shape this
  extends: it already orders claims, names their waits and asks for long waits in the background.
  Reused as is; gains the per-claim reason and cheapest evidence, the wait total and the owed
  entries.
- **The plan-items gate and the ticket gate** share their core (frontmatter, keys, enums, links).
  The new key and rules are written on that core; the reachability walk over `blocked_by` is new
  and stays in the plan-items check, since tickets have no final item.
- **The owner's order of 2026-11-15** and check-hooks' `Device:`
  lines are the first instance of the final-check shape, done by hand. This spec makes it the
  convention and moves the criteria into the one item, which check-hooks lost one of by deleting
  item 02.
- **Check hooks** ([[2026-11-15-check-hooks-design]]) cut setup and teardown per run; this spec
  cuts the number of runs and the claims in each. Nothing is shared beyond the skill both edit;
  the two land in either order, and the later rewrites its part of the skill on top of the other.

## Failure modes

| Mode | Visible outcome | Recovery |
| --- | --- | --- |
| A plan in flight (check-hooks) has `Device:` lines in several items when the gate lands | `npm run verify` names each item holding one | Move the lines into its last item, mark it `final_check: true`, recover lost lines from git (item 02's) |
| A worker's item lands and its file is deleted | Nothing lost: its device criteria were in the final check from the start | — |
| The final check finds a defect | The check reports `failed` with evidence; the plan is not closed | A fix on the integration branch, then a re-check brief with the failed claims and those the fix can touch, one build |
| The phone drops off mid-check | The unrun claims are `blocked`, the report says so early | One re-dispatch with only the `blocked` claims |
| A risky native item could break later items, found only at the end | The final check fails on the first claim that depends on it; the debug log and logcat name the cause | Fixed as any defect; a check of the item alone is not added back. Host-side evidence (a dex grep of the APK) stays the worker's, being no device criterion |
| A claim really needs a long real-time wait (a process dead for minutes) | The check plan lists it among its waits, with its length, before dispatch | The caller runs it in the background while the other claims run, or the owner cuts it |
| A criterion uses the word "device" without the prefix | Not read as a device criterion; the gate stays silent | Review against this spec; the prefix is the convention |
| The agent runs a variant beyond the plan anyway | The report shows steps the plan did not name | Review of the report; the skill's rule is the reference |
| A ticket (not a plan) needs a device check | Unchanged: one check per ticket; the gate does not apply to tickets | — |

## Out of Scope

- The toolkit's speed and its commands: done by [[2026-11-14-device-check-speed-design]].
- Setup, teardown and state reads without the screen: [[2026-11-15-check-hooks-design]].
- A faster path for a JS-only build ([[T-110-js-only-build-path]]) and the build's identity
  ([[T-109-device-check-trust-and-build]]).
- The user-level skills outside this repo (`implement-many`, `implement-spec`, `to-tickets`). They
  read this repo's plan conventions; changing them is the owner's call across projects.
- A gate that stops a worker from driving the phone: no test can see it. The conventions and the
  worker brief carry it.
- A linter for check plans: considered with the owner on 2026-11-15 and not taken.
- Re-checking past efforts' evidence: built plans stay as they are.

## Further Notes

- The figures come from a script over the session transcripts; a command's bucket was told from its
  text, so they are approximate, and "model turns" includes idle time while a background build or
  walk ran.
- The same transcripts show the toolkit work did its part: a toolkit call went from 27 s to 16 s
  and screenshots from 36 to 11 between the original and the re-run of 2026-11-14. What stayed is
  the number of runs and claims.
- Success reads from the next plan with device criteria: one run (plus a narrow re-check at most),
  one build for the check, and wall time well under the 300 minutes of
  recording-survives-process-death.
