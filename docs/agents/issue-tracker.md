# Issue tracker

Two trackers, split by **source** — never by author:

- **Internal findings** — anything the development process produces: a review pass, a dead-code
  sweep, a refactor backlog row, a field observation the owner made themselves. They live in this
  repo, in `docs/reviews/open-work.md`.
- **Outside reports** — a user's bug report, an outside feature request, anything with a reporter
  who needs a reply. They live in GitHub Issues on `z0rzi/on-foot`.

The test is **who needs to read it**. If someone outside the work must see it or respond to it, it
belongs on the issue board. If only the owner and the agents doing the work need it, it belongs in
the worklist — however user-visible the underlying bug is.

GitHub Issues holds nothing today, because no outside report has arrived yet. **Never file internal
findings there.** This is the standing decision (2026-10-09), not a deferral; the reasoning is at
the end of this file.

## Where internal work lives

- **The worklist** — `docs/reviews/open-work.md`. The single standing index of what is left.
  Entries are prose, keyed by an ID (`FIELD-n`, `ERR-n`, `ARCH-n`, `DEAD-n`, `DOC-n`, `DUP-n`,
  `TEST-n`, `PERF-n`), each carrying a severity (`should-fix` / `minor` / `investigate`), a size
  (`S`/`M`/`L`), and its evidence inline. A finding ruled `accept` or `none` is not open work and
  is not listed; its ruling lives in the report that raised it.
- **Review reports** — `docs/reviews/<date>-<name>.md`. Dated snapshots.
  `docs/reviews/2026-09-10-full-review.md` stays **authoritative** for the findings it raised: its
  rows hold the evidence and are ticked in place, and the worklist only indexes what is still open
  there.
- **Specs and plans** — `docs/design/specs/YYYY-MM-DD-<slug>-design.md` and
  `docs/design/plans/YYYY-MM-DD-<slug>.md`. `AGENTS.md` requires features to go
  brainstorm → spec → plan; every spec carries an `## Existing shape` and a `## Failure modes`
  section.

Those three are the only homes. Do not create a fourth, and do not create `.scratch/`.

## When a skill says "publish to the issue tracker"

For internal work, append an entry to `docs/reviews/open-work.md` — under
`## Proposed work — not from the review` when it did not come from a review. The worklist is
explicitly the index for work proposed outside a review too, so a ticket batch belongs there rather
than in a second list of its own. For an outside report, see **Outside reports** below.

An entry is: a bolded ID or title, a `·` separated severity and size, then the evidence in prose —
file and line citations, not a restatement of the title. Match the voice of the entries already
there.

Correct the `## At a glance` count in the same edit, by enumeration. When an item closes, remove it
and fix the count in the same commit.

A feature-sized request is not a worklist entry: it goes brainstorm → spec → plan under
`docs/design/`, and the worklist entry, if any, just points at the spec.

## When a skill says "fetch the relevant ticket"

Read the entry by its ID from `docs/reviews/open-work.md`. If it came from a review, also read that
finding's row in the authoritative report for the full evidence. An outside report is read with
`gh issue view <n> --comments`.

## Triage state

The worklist has no label objects. Record a triage role as a trailing tag on the entry's severity
line, using the strings in `triage-labels.md` — e.g. `**ERR-7** · should-fix, S, ready-for-agent`.
On GitHub Issues the same strings are real labels.

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
  both, is in the seed template `.claude/skills/setup-matt-pocock-skills/issue-tracker-github.md`.

An outside report that becomes internal work gets a worklist entry that cites the issue by number,
and the issue is closed with a comment when the work lands. Neither copies the other's evidence.

## Why the split

**GitHub Issues is a communication surface.** It exists to coordinate people who don't share a
workspace: reporter and maintainer, contributor and reviewer. This project is solo and AI-written,
so the backlog's only readers are the owner and agents with the repo checked out — there is no
counterparty, and filing the backlog to the board would pay coordination overhead for nobody. It
would also make internal hygiene work the repo's front door: a public activity feed and
notification stream dominated by `DEAD-2` opening and closing, which is the first thing a future
user would see.

**One file resists duplication.** An agent adding to the worklist reads the whole file first and
sees every open item at once, which is how it knows `ERR-6` is `ERR-3`'s defect class and that
`DOC-5` pairs with `ARCH-4`. An issue board offers a paginated list of titles; knowing whether
something is already filed means querying and reading. The single file is a feature for an
AI-maintained list, not a limitation of it.

**The repo is public, so the worklist is already public.** What the split controls is reach, not
secrecy: a committed file is public but unbrowsed, while an issue board is syndicated through
notifications, the activity feed and search.
