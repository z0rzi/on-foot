# Issue tracker

Two trackers, split by **source** — never by author:

- **Internal findings** — anything the development process produces: a review pass, a dead-code
  sweep, a refactor backlog row, a field observation the owner made themselves, an idea the owner
  parked. They live in this repo, one file per ticket under `docs/tickets/`.
- **Outside reports** — a user's bug report, an outside feature request, anything with a reporter
  who needs a reply. They live in GitHub Issues on `z0rzi/on-foot`.

The test is **who needs to read it**. If someone outside the work must see it or respond to it, it
belongs on the issue board. If only the owner and the agents doing the work need it, it belongs in
the worklist — however user-visible the underlying bug is.

GitHub Issues holds nothing today, because no outside report has arrived yet. **Never file internal
findings there.** This is the standing decision (2026-10-09), not a deferral; the reasoning is at
the end of this file.

## Where internal work lives

- **The worklist** — `docs/tickets/<area>/T-<n>-<slug>.md`, one file per open ticket. The ID is
  `T-<n>` on one counter shared by every ticket. The next number is the highest **ever issued** plus
  one, not the highest on disk: closed tickets are deleted, so look through git as well
  (`git log --all --diff-filter=A --name-only -- docs/tickets docs/reviews/open-work | sort -u`). The folder is the ticket's **area**, the product surface it belongs to, one of `map`,
  `recording`, `trails`, `activities`, `elevation`, `offline`, `settings`, `app-shell`, or
  `tooling` for the development tools themselves (the device-check toolkit, the gates). An area
  folder exists only while it holds a ticket; a ticket touching two areas goes in the one its fix
  lands in. `docs/tickets/README.md` explains the folder, `docs/tickets/tickets.base` is the
  Obsidian view, `docs/tickets/device-checks.md` lists the device claims no device has confirmed.
  A finding ruled `accept` or `none` is not open work and has no file; its ruling lives in the
  report that raised it. Before 2026-11-06 IDs carried a prefix (`IDEA-18`, `PROP-46`, `FIELD-5`);
  the counter was already shared, so `T-<n>` names the same ticket.
- **Review reports** — `docs/reviews/<date>-<name>.md`. Dated snapshots.
  `docs/reviews/2026-09-10-full-review.md` stays **authoritative** for the findings it raised: its
  rows hold the evidence and are ticked in place, and a ticket file from it links back with
  `from: "[[2026-09-10-full-review]]"`.
- **Specs and plans** — `docs/design/specs/YYYY-MM-DD-<slug>-design.md` and
  `docs/design/plans/YYYY-MM-DD-<slug>/`, a folder: `plan.md` and one **work item** file per
  slice of the build (below). Older plans are single files; they stay. `AGENTS.md` requires
  features to go brainstorm → spec → plan; every spec carries an `## Existing shape` and a
  `## Failure modes` section.

Those three are the only homes. Do not create a fourth. `.scratch/` is the gitignored agent
scratchpad, not a tracker: the upstream skills' `.scratch/<feature>/` spec and ticket layout does
not apply here; a plan's items live in its folder and wayfinder maps under `docs/design/` (below).

## Plan work items

A **work item** is one slice of a plan: born when `/to-tickets` breaks a spec down, claimed by one
worker, gone when its merge lands. It is not a ticket. It takes no `T-n` number, never enters
`docs/tickets/`, and is found through its plan, never by area. The tracker receives from a build
only what outlives it: a follow-up filed with `from: "[[the-spec]]"`, or what the spec defers as
"ticket later".

The plan is the folder `docs/design/plans/YYYY-MM-DD-<slug>/`:

- `plan.md` — the overview, the item list (number, title, what it delivers) and anything the
  build needs that the spec does not say. It is the record that survives the build; it is not
  ticked or edited as items land. Blocking and `closes` live in the items only, never here.
- `NN-<slug>.md` — one per item, numbered from `01` in dependency order, blockers first. Addressed
  as `<slug>/NN` in prose (`hiking-ux/03`), `(<slug> NN)` in a commit trailer; the worker branch is
  `<slug>-NN`, the integration branch `<slug>`.

```markdown
---
status: open             # open | claimed; a landed item is deleted, not marked
blocked_by: []           # wikilinks to items of this plan: ["[[01-status-pill]]"]
closes: []               # wikilinks to open tracker tickets this item retires: ["[[T-14-hiking-ux-without-nav-bar]]"]
final_check: false       # true on the plan's final check only; absent reads as false
---
# 03: the elevation graph is the sheet's header

**What to build:** the end-to-end behaviour, from the user's side.

- [ ] Acceptance criterion
- [ ] `npm run verify` green
```

A **device criterion** is an acceptance line only the phone can tick, written as a checkbox whose
text starts `Device:` (`- [ ] Device: the puck follows the walk`). A line that mentions the device
in another sense, such as a criterion about the `device-check` skill, is not one, nor is a line in
a fenced code block. A plan's device criteria live in one item only, its **final check**: the item
with `final_check: true`, numbered last, listed in no item's `blocked_by`, and blocked by every
other item, directly or through items that block it. Its body lists the device criteria grouped by
the item they come from, then the claim-set waits and the owner's feel items. A plan with no device
criterion has no final check.

- A worker on any other item does no device work: no build for the phone, no install, no check. An
  item whose change needs the phone to confirm puts its `Device:` line in the final check, so it
  survives the item's file being deleted at landing.
- The final check is dispatched once, after the plan's last code review, on the integrated build,
  with a check plan copied from its body (`.claude/skills/device-check/BRIEF.md`).
- A defect it finds is fixed by an item or a fix on the integration branch, then re-checked on one
  new build: the failed claims and the claims the fix can touch, not the whole list again. A fix
  item takes the final check's number and the final check the next one, so it stays last.
- The claims it could not confirm on the device, the owner's feel items among them, go to
  `docs/tickets/device-checks.md` in the merge that lands it, as one entry for the plan: a bold
  lead naming it and its spec, what was confirmed and when, what stays owed, so they outlive the
  file the landing deletes.

A worker sets `status: claimed` before starting. The merge that lands an item deletes its file and
every ticket its `closes` names, and drops the item from its siblings' `blocked_by`. A folder with
only `plan.md` left is a built effort; the spec's status line says so (`**Status:** Built,
[[2026-11-06-hiking-ux]]`). `plans.base` beside the
folders is the Obsidian view: by plan, the frontier (open and unblocked), the claimed.

`src/architecture/__tests__/planItems.test.ts` enforces the folder shape (`plan.md` present, item
names, numbers unique within a plan, nothing nested), the three keys and the optional
`final_check` (`true` | `false`), `blocked_by` resolving within the plan and `closes` resolving to
an open ticket, and the heading. In a plan with any device criterion it enforces the final check:
exactly one item has `final_check: true` and it carries the plan's highest item number, no
device criterion sits outside it, every other item reaches it through `blocked_by`, and none is
blocked by it. A `final_check` item with no device criterion is flagged in any plan. It shares its
core with the ticket check (`src/architecture/markdownItems.ts`).

## Ideas

An **idea** is a ticket with `category: idea`: a parked wish of the owner's or an agent's, not
committed work. It has no severity, no size and no triage, and nobody is waiting on it. It lives in
its area folder like any ticket so that the ticket scan catches a new finding that is really an
existing idea. It leaves that state one of three ways: **promoted** — its category becomes
`enhancement` (or whatever it is) and it gets triaged; a feature-sized one goes to a spec and the
ticket points at it; **dropped** — its file is deleted; or it sits. An idea never carries a triage
role: the test refuses the combination.

## When a skill says "publish to the issue tracker"

For internal work, first run the `scan-tickets` skill on the new finding: it reads the whole
worklist and reports whether the finding is an existing ticket's defect class, duplicates one, is
an idea already parked, collides with one or folds into one, and you put that to the owner. Then
create `docs/tickets/<area>/T-<n>-<slug>.md` with the next number (highest ever issued plus
one, see above). A ticket batch is one file per ticket, never a combined file. For an outside report, see
**Outside reports** below.

A ticket file is frontmatter, a `# T-<n>: <title>` heading, then the evidence in prose — file and
line citations, not a restatement of the title. Match the voice of the files already there.

```markdown
---
severity: should-fix     # should-fix | minor | investigate, empty when unknown (always empty on an idea)
category: bug            # bug | enhancement | refactor | docs | tests | idea
size: S                  # S | M | L, empty when unknown
triage:                  # a role from triage-labels.md except wontfix; empty until triaged, always empty on an idea
origin: agent            # owner | agent — who raised it; a review or device-check finding is agent
filed: 2026-11-02        # the day it entered the tracker, YYYY-MM-DD
from: "[[2026-11-02-last-camera-design]]"   # optional context: the spec, report or parent ticket it follows from, or a short note ("device check, 2026-11-02")
blocked_by: []           # wikilinks to other ticket files: ["[[T-3-...]]"]
---
# T-49: a preference change before or after a failed hydration overwrites the stored preferences
```

`src/architecture/__tests__/tickets.test.ts` enforces the area folder, the file name, unique IDs
across areas, these eight keys and their values, the idea invariant, `blocked_by` links resolving
to open tickets, and the heading, so a ticket that drifts fails `npm run verify`. A new field or a
new area is a convention change: make it here and in `src/architecture/tickets.ts` together. The
per-triage sections below are not checked; their quality is a review matter.

A file that exists is open. When an item closes, delete its file in the commit that closes it, and
drop it from any other ticket's `blocked_by`. Its history is in git.

A feature-sized request is not a worklist entry: it goes brainstorm → spec → plan under
`docs/design/`, and the worklist entry, if any, just points at the spec through `from`.

## When `/to-tickets` breaks a spec into work

The tickets it produces are **work items**, not worklist tickets. Publish them as the plan folder
above: create `docs/design/plans/YYYY-MM-DD-<slug>/plan.md` with the item table, then one
`NN-<slug>.md` per item in dependency order, using the item template, with `closes` naming every
open worklist ticket the item retires. Every `Device:` criterion goes in the plan's final check,
never in the item whose change it confirms (see **Plan work items**). Nothing goes to
`docs/tickets/`.

## When `/implement-spec` or `/implement` takes an item

Read the plan folder; the frontier is every `status: open` item whose `blocked_by` is empty. Claim
it by setting `status: claimed` in a commit on the worker branch `<slug>-NN`. Only the final check does device
work (see **Plan work items**). Resolve it the way
the tracker closes work: the merge into the integration branch deletes the item file and the
tickets it closes. A worker that passes a ticket reference (`T-n`) instead works a worklist ticket
on `ticket/T-n` as before. Either branch lands on `master` squashed into one commit (see
`AGENTS.md`, Git history).

## When a skill says "fetch the relevant ticket"

Read `docs/tickets/*/T-<n>-*.md`, and run the `scan-tickets` skill on it before its work starts.
If it came from a review, also read that finding's row in the authoritative report for the full
evidence. An outside report is read with
`gh issue view <n> --comments`.

## Triage state

A ticket file records its triage role in the `triage:` frontmatter field, using the strings in
`triage-labels.md` — e.g. `triage: ready-for-agent` — and the kind of work in `category:`. An idea
has no triage role. A `ready-for-agent` ticket ends with an `## Agent Brief` section, a
`ready-for-human` one with `## Why a human`, and a `needs-info` one with `## Triage Notes`; those
sections are the contract an agent works from. On GitHub Issues the same strings are real
labels.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a file with one **child** file per ticket, under
`docs/design/wayfinder/<effort>/`: a sibling of the plan folder (a map instead of a plan, decisions
instead of slices, `Status:` lines instead of frontmatter), not gated.

- **Map**: `docs/design/wayfinder/<effort>/map.md` (the Notes / Decisions-so-far / Fog body).
- **Child ticket**: `docs/design/wayfinder/<effort>/issues/NN-<slug>.md`, numbered from `01`, with
  the question in the body. A `Type:` line records `research`/`prototype`/`grilling`/`task`; a
  `Status:` line records `claimed`/`resolved`.
- **Blocking**: a `Blocked by: NN, NN` line near the top. A ticket is unblocked when every file it
  lists is `resolved`.
- **Frontier**: scan `issues/` for files that are open, unblocked and unclaimed; lowest number wins.
- **Claim**: set `Status: claimed` and save before any work.
- **Resolve**: append the answer under an `## Answer` heading, set `Status: resolved`, then append a
  context pointer to the map's Decisions-so-far.

## Outside reports — GitHub Issues

Conventions for the board, applied from the first report onward. Use the `gh` CLI; it infers the
repo from `git remote -v`.

- **Tooling**: `gh` 2.63.0 is installed and authenticated as `z0rzi` (scopes include `repo`);
  issues are enabled on the repo.
- **Labels do not exist yet.** Before the first triage, create the five from `triage-labels.md`:
  `gh label create <name>`.
- **Read**: `gh issue view <n> --comments`. **List**: `gh issue list --state open --label needs-triage`.
- **Comment**: `gh issue comment <n> --body "..."`. **Label**:
  `gh issue edit <n> --add-label "..." --remove-label "..."`.
- **Close**: `gh issue close <n> --reason completed` or `--reason "not planned"`, with a comment
  saying what landed or why not.
- **Create** (rare — reports come from outside; the owner may file one as a user):
  `gh issue create --title "..." --body-file -` with a heredoc body.
- **Sub-issues** need `gh` 2.94+ for `--add-sub-issue`; on 2.63.0 use the REST `sub_issues`
  endpoint. **Blocking** uses GitHub's native issue dependencies. The full command set, including
  both, is in the seed template `.agents/skills/setup-matt-pocock-skills/issue-tracker-github.md`.

An outside report that becomes internal work gets a ticket file whose `from:` cites the issue by number,
and the issue is closed with a comment when the work lands. Neither copies the other's evidence.

## Why the split

**GitHub Issues is a communication surface.** It exists to coordinate people who don't share a
workspace: reporter and maintainer, contributor and reviewer. This project is solo and AI-written,
so the backlog's only readers are the owner and agents with the repo checked out — there is no
counterparty, and filing the backlog to the board would pay coordination overhead for nobody. It
would also make internal hygiene work the repo's front door: a public activity feed and
notification stream dominated by `DEAD-2` opening and closing, which is the first thing a future
user would see.

**One folder, read end to end, resists duplication.** An agent adding to the worklist or taking a
ticket from it has every open ticket read first (the `scan-tickets` skill), which is how it knows
`ERR-6` is `ERR-3`'s defect class and that `DOC-5` pairs with `ARCH-4`. An issue board offers a paginated list of titles; knowing whether something is
already filed means querying and reading. The worklist was one file until 2026-10-26; it was split
into a file per ticket so the owner can see and filter it as an Obsidian base, and the ticket
scan keeps the property the single file gave. On 2026-11-06 the tickets moved from
`docs/reviews/open-work/` into a folder per area under `docs/tickets/`, and the ID prefixes went:
the prefix had encoded who raised a ticket and which review kind it was, which is now `origin` and
`category`, and it was the only grouping the flat folder offered, which the area folder does
better.

**The repo is public, so the worklist is already public.** What the split controls is reach, not
secrecy: a committed file is public but unbrowsed, while an issue board is syndicated through
notifications, the activity feed and search.
