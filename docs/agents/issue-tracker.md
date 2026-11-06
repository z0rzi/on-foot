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
  `recording`, `trails`, `activities`, `elevation`, `offline`, `settings`, `app-shell`. An area
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
  `docs/design/plans/YYYY-MM-DD-<slug>.md`. `AGENTS.md` requires features to go
  brainstorm → spec → plan; every spec carries an `## Existing shape` and a `## Failure modes`
  section.

Those three are the only homes. Do not create a fourth. `.scratch/` is the gitignored agent
scratchpad, not a tracker: the upstream skills' `.scratch/<feature>/` spec and ticket layout does
not apply here, and wayfinder maps live under `docs/design/` (below).

## Ideas

An **idea** is a ticket with `category: idea`: a parked wish of the owner's or an agent's, not
committed work. It has no severity, no size and no triage, and nobody is waiting on it. It lives in
its area folder like any ticket so that the read-all rule catches a new finding that is really an
existing idea. It leaves that state one of three ways: **promoted** — its category becomes
`enhancement` (or whatever it is) and it gets triaged; a feature-sized one goes to a spec and the
ticket points at it; **dropped** — its file is deleted; or it sits. An idea never carries a triage
role: the test refuses the combination.

## When a skill says "publish to the issue tracker"

For internal work, first read every file under `docs/tickets/`: it is a short tree, and reading all
of it is how you notice that a new finding is an existing ticket's defect class, duplicates one, or
is an idea already parked. Then create `docs/tickets/<area>/T-<n>-<slug>.md` with the next number (highest ever issued plus
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

## When a skill says "fetch the relevant ticket"

Read `docs/tickets/*/T-<n>-*.md`. If it came from a review, also read that finding's row in the
authoritative report for the full evidence. An outside report is read with
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
`docs/design/wayfinder/<effort>/`.

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

**One folder, read end to end, resists duplication.** An agent adding to the worklist reads every
open ticket first, which is how it knows `ERR-6` is `ERR-3`'s defect class and that `DOC-5` pairs
with `ARCH-4`. An issue board offers a paginated list of titles; knowing whether something is
already filed means querying and reading. The worklist was one file until 2026-10-26; it was split
into a file per ticket so the owner can see and filter it as an Obsidian base, and the read-all
rule above keeps the property the single file gave. On 2026-11-06 the tickets moved from
`docs/reviews/open-work/` into a folder per area under `docs/tickets/`, and the ID prefixes went:
the prefix had encoded who raised a ticket and which review kind it was, which is now `origin` and
`category`, and it was the only grouping the flat folder offered, which the area folder does
better.

**The repo is public, so the worklist is already public.** What the split controls is reach, not
secrecy: a committed file is public but unbrowsed, while an issue board is syndicated through
notifications, the activity feed and search.
