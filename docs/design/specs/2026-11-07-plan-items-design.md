# Plan work items live with their plan

A spec goes through `/to-tickets` and `/implement-spec`: the breakdown becomes tickets, workers take
them in worktrees, each merge into the integration branch closes one. On 2026-11-06 the hiking UX
spec became sixteen tracker tickets, T-50 to T-65, spread over five area folders beside month-old
ideas and review findings. They were never the tracker's kind of thing: born from one spec, owned by
one worker for a day, dead at merge. Decided with the owner on 2026-11-07 in a grilling session.

## The decisions

1. **Two kinds of thing, two homes.** A **ticket** is durable: an idea, a finding, a follow-up,
   owned by nobody in particular, found by area. A **work item** is one slice of a plan, claimed by
   one worker, gone when its merge lands. Items are not tickets: they consume no `T-n` number and
   never enter `docs/tickets/`.
2. **A plan is a folder**: `docs/design/plans/<date>-<slug>/` holding `plan.md` (the overview, the
   item table with its blocking graph, what each item closes in the tracker) and one
   `NN-<slug>.md` per item, numbered in dependency order as `/to-tickets` already does. `plan.md` is
   the record that survives. The flat plans already under `docs/design/plans/` stay as they are.
3. **Items die at merge**: the merge that lands an item deletes its file, the rule tickets follow.
   No `done` status and no ticking in `plan.md`; a folder with only `plan.md` left is a built
   effort, and the spec's status line says so.
4. **Naming**: `hiking-ux/03` in prose, commit trailer `(hiking-ux 03)`, worker branch
   `hiking-ux-03`, integration branch `hiking-ux`. A slash-namespaced item branch is impossible
   beside an integration branch of the same name. `ticket/T-n` stays for durable tickets.
5. **Frontmatter and a gate**: `status: open | claimed`, `blocked_by` (wikilinks to items of the
   same plan), `closes` (wikilinks to open tracker tickets the item retires), heading `# NN: title`.
   The gate checks every plan folder: a `plan.md` present, item names, numbers unique within the
   folder, keys, enums, both link fields resolving, the heading. The upstream skills carry their
   own shapes (`.scratch/<feature>/issues/`, `Status:` lines) and pull every run toward them.
6. **One base for all plans**: `docs/design/plans/plans.base`, grouped by plan, with a Frontier
   view (open, unblocked) and a Claimed view.
7. **hiking-ux is left alone**: its six remaining tickets, three of them checked out in worker
   worktrees, close by deletion as before. The convention applies from the next plan.
8. **What reaches the tracker from a build**: only what outlives it, a follow-up with
   `from: [[the spec]]`, or what a spec defers as "ticket later". A tracker ticket an item retires
   is deleted in the item's merge, as today.

## Existing shape

The ticket gate ([[2026-11-06-tickets-by-area-design]]): a folder of markdown items with
frontmatter, enums and wikilink fields resolving to siblings. This is its second instance, so the
shared core is extracted into `src/architecture/markdownItems.ts`: the recursive collector,
`readFrontmatter`, `checkKeys`, `checkEnums`, `checkLinks`, `checkHeading`. `tickets.ts` keeps only
what is a ticket's: areas, `T-n`, the date, the idea invariant. `planItems.ts` keeps only what is a
plan's: `plan.md`, `NN` numbering per folder, `closes` against the worklist. The wayfinder layout in
`issue-tracker.md` is the same shape in prose and now points at it.

The duplication gate did not see through a multi-line import: its import exclusion matched the
first line only, so the two identical specifier lists read as nine duplicated lines. Fixed at the
gate, with a unit case, rather than by reshaping the imports.

## Failure modes

- **A plan folder without `plan.md`**: violation on the folder. A folder is a plan or nothing.
- **A file in a plan folder that is neither `plan.md` nor `NN-slug.md`** (notes, a draft):
  violation. Drafts go to `.scratch/`.
- **An item nested deeper** (`issues/01-x.md`, the upstream layout): violation.
- **`blocked_by` naming an item of another plan**: violation; blocking is within a plan.
- **`closes` naming a closed or unknown ticket**: violation; the link is checked against the
  worklist's open files, so a ticket closed by another branch surfaces at the merge.
- **A worker merges without deleting its item**: the item stays `claimed` and shows in the
  Claimed view; nothing mechanical catches it, as nothing catches an undeleted ticket today.
- **The folder `docs/design/plans/` missing**: the real-tree test fails, as for the worklist.
- **Two plans with the same slug on different dates**: distinct folders, no collision.

## Docs

`issue-tracker.md` gains a "Plan work items" section, redirects `/to-tickets` and
`/implement-spec` through it, and the wayfinder section names the shared shape. `AGENTS.md`,
`README.md` and `docs/agents/domain.md` mention the plan folder. The glossary gains Work item.
