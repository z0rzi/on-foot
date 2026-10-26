# A hard check on the worklist's ticket files

The worklist became one file per ticket on 2026-10-26 (`docs/reviews/open-work/`), viewed as an
Obsidian base. Its conventions live in `docs/agents/issue-tracker.md` and nothing enforces them.

## The problem

The upstream skills (`/to-tickets`, `/triage`) carry their own ticket shape: `.scratch/<feature>/
issues/`, a `status:` field, no `severity`. Every invocation pulls an agent toward it. A ticket that
drifts fails silently: the base shows a blank cell or drops the row, and an agent filing the next
ticket reads a list that no longer means what it says.

## The decision

A Jest test in `src/architecture/` checks what the base and the agents depend on mechanically:

1. **File name** — `<PREFIX>-<n>-<slug>.md`, with `PREFIX` one of `FIELD`, `ERR`, `ARCH`, `DEAD`,
   `DOC`, `DUP`, `TEST`, `PERF`, `PROP`, and a lowercase kebab slug. Every `.md` file in the folder
   is a ticket, so a combined `tickets.md` fails here.
2. **Unique ID** — no two files share `<PREFIX>-<n>`.
3. **Frontmatter** — present, valid YAML, exactly the keys `severity`, `category`, `size`, `triage`,
   `source`, `blocked_by`:
   - `severity`: `should-fix` | `minor` | `investigate`, or empty;
   - `category`: `bug` | `enhancement`, required;
   - `size`: `S` | `M` | `L`, or empty;
   - `triage`: `needs-triage` | `needs-info` | `ready-for-agent` | `ready-for-human`, or empty.
     `wontfix` is refused: a ruled-out item is deleted, not kept;
   - `source`: a non-empty string;
   - `blocked_by`: a list, each entry `[[<file name without .md>]]` naming a ticket in the folder.
4. **Heading** — the first `# ` heading starts with `<ID>: `.

Deliberately **not** checked: the per-triage sections (`## Agent Brief`, `## Why a human`,
`## Triage Notes`) and brief contents. A test can only see that a heading exists, so requiring one
invites a stub written to pass, which looks done and is worse than a missing section. Brief quality
belongs to review.

## Existing shape

The seams test: a pure `findSeamViolations(files)` over `{ path, content }` records, a collector
that reads the tree (`collectSourceFiles`), and one real-tree test that prints every violation,
beside unit cases on synthetic files. The ticket check copies that shape exactly:
`findTicketViolations(files)` is pure and unit-tested; a small collector reads the folder.

`collectSourceFiles` is not reused: it collects `.ts`/`.tsx` under source roots and skips tests,
none of which fits a docs folder of `.md` files. Generalising it to take an extension and an
exclusion rule would serve two callers with nothing else in common. Nothing else is shared.

The frontmatter is parsed with `yaml` (2.9.x, already in the tree through metro, own types), added
as a direct devDependency. A hand-rolled parser would break the first time Obsidian rewrites a
list or quotes a value.

## Failure modes

- **Folder missing** (renamed, deleted): the real-tree test fails. A missing worklist is not an
  empty one.
- **Folder empty**: passes. No open work is a valid state.
- **Malformed YAML or no frontmatter**: a violation naming the file and the parser's message,
  never a thrown error that hides the other files' violations.
- **Obsidian adds a property** (e.g. `tags`): an unknown-key violation. Intended: a new field is a
  convention change, made in `issue-tracker.md` and here together.
- **Non-`.md` files** in the folder: ignored; they are not tickets and the base ignores them.
- **Run from a worktree**: no change; jest already ignores `/.claude/worktrees/`.
- **Test environment**: the suite's jest-expo environment resolves `yaml` to its ESM browser
  build, which Jest cannot load; the test file runs under `@jest-environment node`, which is what
  it is — Node-side tooling over the repo.

## Docs

`issue-tracker.md` states that the test enforces the conventions, that `severity` and `size` may be
empty, and names the test.
