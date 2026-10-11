---
description: Post-work review of the current unit of work — gate, standards review and spec review, then the decisions put to the owner
---

# Last checks — post-work review

Run this after finishing a unit of work (a task, feature, or fix), **before** declaring it done
or merging. The review itself is `/code-review`: a Standards axis reading `CODING_STANDARDS.md`
and a Spec axis reading the feature's spec, in parallel sub-agents with no session context. This
command starts the gate, pins the diff, finds the spec, and owns the follow-through.

There is no list of "deliberate choices" to hand the reviewer. A decision that must not be
re-litigated belongs in the spec, written before the code; a spec that no longer matches what
was built is amended, never excused.

Argument (optional): the path of the spec. Arguments given: `$ARGUMENTS`

## 1. Start the gate

Run `npm run verify` in the background now, so it finishes while the review runs.

## 2. Pin the fixed point

On a feature branch the fixed point is `master`. When the work landed directly on `master`, it
is the first commit of this iteration (`HEAD~<n>`). State which one you chose and why.

Say whether there are uncommitted changes. `/code-review` reads `<fixed-point>...HEAD`, so it
sees committed work only: commit the work first, or say in the relay that the uncommitted part
was not reviewed.

## 3. Find the spec

Use `$ARGUMENTS` when given. Otherwise look under `docs/design/specs/` for the spec matching
the branch name or the feature's name, newest first. Read its title to confirm it is the right
one. If none matches, say so: the Spec axis then reports "no spec available" and the Standards
axis runs alone. That is a normal outcome for a small fix, not an error.

## 4. Review

Call the Skill tool with `code-review`, giving it the fixed point, the diff command from step 2
and the spec path or its absence. `/code-review` refuses when the fixed point does not resolve
or the diff is empty; relay that refusal and stop.

## 5. Relay and take a position

Relay both axes to the user, in full for must-fix and should-fix findings. For each, state your
position: agree, or disagree with the reason (context the reviewer lacked, a spec line it
misread). Do not dismiss a finding because it contradicts what you did.

Collect the gate result from step 1. If it is red, the failure is the **first must-fix** in the
relay, ahead of both axes. The review is not shortened because the gate failed: one lint error
must not hide an architecture finding in the same diff.

## 6. Fix

- **Unambiguous cleanups** (dead code, a stray debug log, a lint or type error): apply them
  directly and note it.
- **Everything else**: stop and ask the user before applying. The review ends in a decision the
  owner makes.

Re-run `npm run verify` after any fix.

## 7. Then

Follow with `/_if-from-zero`.

If a must-fix was caught by no gate and by no standard in `CODING_STANDARDS.md`, run `/retro`
on the session: the class of mistake becomes a gate when it is mechanical, or a standard when it
is a judgement call.
