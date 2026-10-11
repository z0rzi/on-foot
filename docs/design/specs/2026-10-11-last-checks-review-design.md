# Replace the post-work checklist with a standards-and-spec review

Settled by grilling on 2026-10-11. Recorded as ADR-0001.

## Problem Statement

The owner runs a post-work review after every unit of work. Today that review is `/retro-quality`:
a bespoke reviewer agent walks a six-check procedure in `POST-WORK.md`, runs the gate, and reports.
Three things are wrong with it from the owner's seat.

- The reviewer is told which decisions it may not question by a "deliberate choices" list that the
  implementer writes after the fact. The implementer curates its own exemptions.
- The checklist is a procedure, not a set of standards. It cannot be grown by `/retro`, is not read
  by `/code-review`, and so sits outside the quality loop the Matt Pocock skills assume.
- The review is serial and slow for what it does, and the owner wants a review they can run often.

Separately, the owner's own commands are hard to pick out of the slash-command list among the
built-in and third-party ones.

## Solution

The review becomes a thin project command, `/_last-checks`, that starts the gate, finds the spec,
and delegates to `/code-review`. Standards come from a new root `CODING_STANDARDS.md` that holds
only the review-time rules, with the `AGENTS.md` principles as its base. Decisions come from the
feature's spec, written before the code, so no after-the-fact exemption list exists. `POST-WORK.md`
is deleted. Specs gain a required `## Failure modes` section so the degraded-mode check survives as
a spec requirement. The owner's five most-used commands take a leading underscore so `/_` lists
them together.

## Existing shape

The closest existing feature of the same shape is **`/health-check`**: a project command that reads
`AGENTS.md`, scopes a review, delegates reading to the agent, and closes out by turning findings into
gates. `/_last-checks` reuses its close-out vocabulary and its spec audit step (which today checks
for `## Existing shape` and will now also check for `## Failure modes`). What is extracted to be
shared is the standards file itself: both `/_last-checks` (through `/code-review`) and any future
`/retro` read and grow one `CODING_STANDARDS.md` rather than each carrying its own rules.

The second existing shape is the `## Existing shape` rule in `AGENTS.md`: one sentence that makes a
spec section mandatory, audited by `/health-check`. `## Failure modes` copies that mechanism exactly
rather than introducing a spec template file.

## Failure modes

- **No spec for the change** (a small fix): the Spec axis reports "no spec available" and the
  Standards axis runs alone. Visible in the report; not an error.
- **Gate red**: `npm run verify` fails while the review runs. The failure is relayed as the first
  must-fix. The review is not aborted.
- **Fixed point missing or diff empty**: `/code-review` refuses before spawning sub-agents. The
  command relays that refusal and stops.
- **Spec found but stale** (behaviour changed in conversation after the spec was written): the Spec
  axis reports a false mismatch. The owner's answer is to amend the spec, never to add an
  exemption list to the command.
- **A leading-underscore name rejected by the harness**: the docs allow it; if a rename fails to
  appear under `/_`, the fallback is a letter prefix, decided with the owner.

## User Stories

1. As the owner, I want to run one command after a unit of work, so that the gate, the standards
   review and the spec review happen without me orchestrating them.
2. As the owner, I want the reviewer to judge my decisions against the spec I wrote beforehand, so
   that I cannot excuse a choice by listing it after the fact.
3. As the owner, I want a change with no spec to still get a standards review, so that small fixes
   are not exempt from review.
4. As the owner, I want a red gate reported alongside the review findings rather than instead of
   them, so that one lint error does not hide an architecture problem in the same diff.
5. As the owner, I want unambiguous cleanups (dead code, a stray log, a type error) applied without
   being asked, and everything else put to me, so that the review ends in a decision I own.
6. As the owner, I want to be told when a must-fix slipped past every gate and standard, so that I
   run `/retro` and the class of mistake becomes a gate or a standard.
7. As the owner, I want `/_if-from-zero` to follow the review as it does today, so that
   architectural fit is still questioned after every unit of work.
8. As the owner, I want to type `/_` and see my own commands grouped, so that I can find them
   without remembering their names.
9. As the owner, I want the review to finish faster than today, so that I run it often rather than
   batching work to avoid it.
10. As an implementing agent, I want `AGENTS.md` to keep its architecture principles, so that the
    rules that steer implementation (seams, TDD, persist the minimum) are in my context from the
    first turn.
11. As a reviewing agent, I want one standards file that states only what tooling does not already
    enforce, so that I spend my words on judgement calls and not on repeating `tsc` or the seams
    test.
12. As a reviewing agent, I want each standard to say what it is, why it matters and how to fix a
    breach, so that I can cite it and propose the fix in one line.
13. As a reviewing agent, I want the spec to list the failure modes the feature handles, so that a
    missing degraded-mode outcome is a spec mismatch I can quote.
14. As a reviewing agent, I want the spec's `## Existing shape` section, so that a renamed copy of
    an existing shape is a spec mismatch and not only a judgement call.
15. As a future agent, I want one ADR that says why there is no post-work checklist, so that I do
    not reintroduce one.
16. As a future agent, I want `/health-check` to point at the current command and standards file,
    so that a live document never sends me to a deleted one.
17. As a future agent, I want dated specs, plans and reports to keep their original wording, so
    that history stays a faithful snapshot.
18. As the owner, I want the `retro-quality` agent gone once the command is thin, so that there is
    one reviewer, the one `/code-review` brings.
19. As the owner, I want the acdc plan to split the reviewer into lanes recorded as superseded for
    this repo, so that it is not ported here later by mistake.

## Implementation Decisions

- **Standards file.** A root `CODING_STANDARDS.md`, which `/code-review` picks up by name. Its
  first lines point at the "Architecture principles" in `AGENTS.md` as the base standard that it
  does not repeat. It then states the review-time rules as what / why / fix, one rule each:
  barrel-versus-leaf imports at the data seam; a wrapped native module's TypeScript types are not
  ground truth for runtime payloads; derived or cached state has one owner; risky render paths
  degrade rather than rely on the root error boundary; every new file names its sibling and says
  what was reused or extracted; every new export has a consumer outside its own file and test;
  presentation logic stays out of the data layer; sibling functions make the same choices
  (caching, error handling, import style, naming); a voided promise is a judgement about whether
  its failure must reach the user; no `any`, `as any`, `@ts-ignore` or `eslint-disable` without
  a one-line justification; icon-only controls carry an accessibility label; comments describe
  the current state, never the change. Anything `npm run verify` enforces (seams, verbatim
  duplication, cycles, secrets, floating promises, lint, types) is omitted by design.
- **`POST-WORK.md` is deleted.** No stub. Live documents that pointed at it now point at
  `CODING_STANDARDS.md` or `/_last-checks`. Dated specs, plans and review reports are untouched.
- **`/_last-checks`.** A project command replacing `/retro-quality`. Steps: start `npm run verify`
  in the background; pin the fixed point (`master`, or the commit range when work landed on
  `master`, noting uncommitted changes); locate the spec under the design directory by branch or
  feature name, else state that there is none; invoke `/code-review`; relay both axes in full for
  must-fix and should-fix, stating agree or disagree with the reason for each; report the gate
  result as the first must-fix if red; apply unambiguous cleanups directly and re-run the gate;
  stop and ask before anything else; then `/_if-from-zero`, and `/retro` when a must-fix was
  caught by no gate and no standard. No "deliberate choices" list. The `retro-quality` agent is
  deleted.
- **Spec requirement.** The `AGENTS.md` sentence that mandates `## Existing shape` now also
  mandates `## Failure modes`: each degraded mode (offline or network drop, permission denied,
  empty or malformed input, cancel mid-operation, render-time throw) with its visible and
  recoverable outcome, "none" acceptable only with the reason. `/health-check`'s spec audit
  checks both sections.
- **`/health-check` pointers.** Its references to `/retro-quality` and `POST-WORK.md` become
  `/_last-checks` and `CODING_STANDARDS.md`; its process-step option names `CODING_STANDARDS.md`
  as the place a judgement-call finding goes. Its own name is unchanged.
- **Underscore rename.** Global commands `challenge-plan`, `full-review`, `if-from-zero`,
  `update-docs` become `_challenge-plan`, `_full-review`, `_if-from-zero`, `_update-docs`. The
  project command is born as `_last-checks`. `deps-check`, `health-check`, `recap`, and all
  skills keep their names. Every live reference to a renamed command follows.
- **ADR.** The first entry in the ADR directory records the decision: review by standards and
  spec, no post-work checklist, and why.
- **Memory.** The note recording the pending acdc lanes port is updated to say this repo took a
  different route and the port is not wanted.

## Testing Decisions

This change is documents and command files. There is no pure logic, so nothing is TDD'd and
`npm run verify` is unaffected beyond staying green.

The only seam at which the change can be verified is the command itself: one dry run of
`/_last-checks` against a real, non-trivial branch, confirming that the gate result, the Standards
report and the Spec report all arrive, that a spec-less run reports "no spec available", and that
the review is noticeably shorter than the serial one it replaces. Prior art for the review is the
2026-09-10 full review and the per-feature reports that `/retro-quality` produced; findings parity
with the last of those is the acceptance bar.

Typing `/_` after the rename and seeing the five commands listed is the test of the rename.

## Out of Scope

- Moving the `AGENTS.md` principles into `CODING_STANDARDS.md` (a later `/retro` candidate).
- A spec template file. The mandatory-section sentence is the mechanism.
- A mechanical test that specs contain the required sections.
- Renaming `deps-check`, `health-check`, `recap`, or any skill.
- Porting the three-lane reviewer design from acdc.
- Creating `GLOSSARY.md`. The words settled here are process vocabulary, not the app's domain.

## Further Notes

The 400-word cap `/code-review` places on each sub-agent means the report no longer states
"clean" per check. That accountability is traded for parallel speed and a standards file that can
grow. If a class of defect starts slipping through, the answer is a new standard or a new gate via
`/retro`, not a longer report.
