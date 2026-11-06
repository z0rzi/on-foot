# Tickets

The worklist: every open piece of internal work, one file per ticket, `<area>/T-<n>-<slug>.md`. A
file that exists is open; closing a ticket deletes its file in the commit that closes it, and git
keeps its history. The folder a ticket sits in is its **area**, the product surface it belongs to:
`map`, `recording`, `trails`, `activities`, `elevation`, `offline`, `settings`, `app-shell`. An area
folder exists only while it holds a ticket.

`tickets.base` is the Obsidian view: by area (newest first), by severity, ready for an agent, the
ideas, and by origin. The conventions, the frontmatter and the filing rules are in
`docs/agents/issue-tracker.md`; `src/architecture/__tests__/tickets.test.ts` enforces them.

A ticket with `category: idea` is a parked wish, not work: no severity, no size, no triage. It is
promoted by changing its category, or dropped by deleting its file.

**IDs before 2026-11-06** carried a prefix (`IDEA-18`, `PROP-46`, `FIELD-5`, `ERR-3`). The counter was
already shared, so `T-<n>` is the same ticket as any prefixed `<PREFIX>-<n>`; commits, specs and
reports that cite the old name are not rewritten.

Device claims no device has confirmed yet are listed in `device-checks.md`.
