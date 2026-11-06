# The worklist by area

The worklist was a flat `docs/reviews/open-work/` of 30 files named `<PREFIX>-<n>-<slug>.md`, viewed
as an Obsidian base. The owner wanted it grouped by what the tickets are about and ordered by date,
and neither was expressible: the only grouping axes were the prefix and the free-text `source`, and
24 of 30 tickets shared the string `owner, tasks.md (moved 2026-10-26)`. Decided with the owner on
2026-11-06 in a grilling session.

## The decisions

1. **Home**: `docs/tickets/<area>/T-<n>-<slug>.md`. The folder is the ticket's **area**, a closed
   list of product surfaces: `map`, `recording`, `trails`, `activities`, `elevation`, `offline`,
   `settings`, `app-shell`. A ticket touching two goes in the one its fix lands in. An area folder
   exists only while it holds a ticket. The review reports stay in `docs/reviews/`.
2. **One ID, one counter**: `T-<n>`. The prefixes (`IDEA`, `PROP`, `FIELD`, `ERR`, …) encoded who
   raised a ticket and which review kind it was; those are now `origin` and `category`. The counter
   was already shared across prefixes and no open number collided, so every ticket keeps its number.
   A bare number was rejected: `#50` autolinks to a GitHub issue in a public repo's commit messages.
   Old names in commits, specs, reports and the device-checks list are not rewritten; the README
   states the mapping and `issue-tracker.md` carries the rule. The next number is the highest ever
   issued plus one, found through git as well as on disk, so a closed number is never reused.
3. **Frontmatter**: `severity`, `category` (`bug | enhancement | refactor | docs | tests | idea`),
   `size`, `triage`, `origin` (`owner | agent`), `filed` (ISO date, required), `from` (optional
   context: a wikilink to the spec, report or parent ticket, or a short note), `blocked_by`.
   `source` is gone: its three jobs were who (`origin`), when (`filed`) and context (`from`).
4. **Idea is a category, not a home**: a parked wish stays in the tracker, in its area, with no
   severity, size or triage. It is promoted by changing its category, or dropped by deleting its
   file. `category: idea` with a triage role is a violation. By severity and Ready for agent exclude ideas;
   By area shows them beside the work, which is the point of the area grouping.
5. **Dates for the migration**: a ticket's `filed` is the day it entered the tracker. `tasks.md` was
   never committed, so the 24 imported ideas carry 2026-10-26, as does PROP-9, split off that day;
   FIELD-5 carries its report's date.
6. **Views**: By area (default, newest first), By severity, Ready for agent, Ideas, By from
   (grouped by the `from` context: the spec, report or parent a ticket follows from).
7. **Companions**: `docs/tickets/README.md` (folder rules, ID mapping note) and
   `docs/tickets/device-checks.md` (the pending-device-checks list, moved out of `open-work.md`,
   old ticket names kept). Glossary gains Ticket, Area, Idea. No ADR: the move is cheap to reverse and the
   reasoning lives in `issue-tracker.md`.

## Existing shape

The ticket check (`src/architecture/tickets.ts`, [[2026-10-26-ticket-conventions-check-design]]):
a pure `findTicketViolations(files)` over `{ path, content }` records, a collector that reads the
tree, one real-tree test beside unit cases on synthetic files. Kept as is; the collector now walks
subfolders and the validator checks the area segment, the new enums, the date and the idea
invariant. The `name` field became `path` because the folder now carries meaning. Nothing else is
shared: the base is a document, the migration was a one-off script in the agent scratchpad.

## Failure modes

- **A ticket at the root or in an unknown or nested folder**: a violation naming the area list.
  A root `.md` that does not look like a ticket (`README.md`, `device-checks.md`) is ignored.
- **A `filed` that is not a calendar date** (`2026-13-40`, a timestamp, a locale format): violation.
  `yaml`'s default schema parses an unquoted date as a string, so the check sees the text.
- **An idea with a triage role**: violation; the fix is to empty the triage or promote the category.
- **An area folder emptied by a closing commit**: git drops the directory; the test tolerates a
  missing area. The list of areas lives in `tickets.ts`, not on disk.
- **A `blocked_by` link across areas**: resolves, because the link is the file's basename and
  Obsidian wikilinks are folder-agnostic.
- **An old prefixed ID cited somewhere**: still readable through the README's mapping rule; the
  number is the same ticket.

## Docs

`issue-tracker.md` is rewritten for the new home, the ID, the frontmatter and the idea rule;
`triage-labels.md`, `AGENTS.md`, `README.md` and `docs/agents/domain.md` point at `docs/tickets/`.
