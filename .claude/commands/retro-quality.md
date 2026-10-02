---
description: Post-work quality control on the current unit of work
---

# Retro-Quality — post-work quality control

Run this after finishing a unit of work (a task, feature, or fix), **before** declaring it
done or merging. The review is delegated to the `retro-quality` agent, which has no session
context: it judges the diff without knowing your intentions, which is what makes it impartial.

## 1. Dispatch the agent

Launch the `retro-quality` agent (Agent tool, `subagent_type: "retro-quality"`) with a prompt
containing:

- the scope: current branch and base (`master`), or the commit range if the work landed
  directly on `master`, and whether there are uncommitted changes;
- the list of **deliberate choices** made during the work (design decisions, accepted
  trade-offs, constraints discovered) — short and factual, no long justification. Without
  this list the agent will re-litigate decisions already made.

Do **not** run the review yourself in parallel: wait for the report.

## 2. Relay and triage

Relay the agent's report to the user, in full for must-fix and should-fix items. For each
finding, state your position: agree, or disagree with the reason (context the agent lacked).
Do not dismiss a finding just because it contradicts what you did.

## 3. Fix

- The **unambiguous cleanups** listed by the agent (dead code, a stray debug log, a lint/type
  error): apply them directly and note it.
- Everything else: **stop and ask** the user before applying.

Re-run `npm run verify` after any fix.

## Then

Follow up with `/if-from-zero`.
