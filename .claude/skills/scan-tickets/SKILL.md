---
name: scan-tickets
description: Scan the whole worklist for tickets that duplicate, collide with, or fold into one subject. Use when a ticket (`T-n`) is about to be worked or looked into, and before a new ticket is filed or pitched.
---

# Scan tickets

One subagent reads the whole worklist against one **subject** and returns its overlaps; you put
them to the owner before the subject's work starts. The subject is either a ticket about to be
worked (`T-96`) or a pitch about to be filed (a finding, an idea, a proposed ticket).

## Steps

1. **Dispatch the scan** as a `general-purpose` agent (it reads whole files; `Explore` reads
   excerpts) with the brief below, filled in. While it runs, read the subject ticket yourself.
   Done when its report states it read every ticket file.
2. **Put the overlaps to the owner** at the top of your reply, before what the subject needs: each
   hit as its ID, title and the one-line reason, bucket by bucket. A clean scan is one line
   (`scan: no overlap, <n> tickets read`). The owner rules on each hit; until they do, the subject's
   scope is the subject alone.
3. **Record each ruling** where the worklist already records it: a ticket folded into another gets
   a `## Folded into T-n (owner, YYYY-MM-DD)` section saying what moved (`T-96` is the model), or
   its file is deleted by the commit that closes both; an order between two becomes `blocked_by`;
   a collision is settled in the ticket whose plan changes. A pitch ruled **same** is not filed:
   the existing ticket gains its new evidence.

## The buckets

- **Same**: the subject is that ticket, its defect class, or an idea already parked.
- **Collides**: the two pull opposite ways. One reverses a ruling the other records, answers an
  `## Open` question the other way, breaks a spec decision or an ADR, or both rewrite the same code
  toward different ends.
- **Folds in**: it closes for little extra because its fix lands in the code the subject already
  changes: the same file, function or layer, cited in both. The report gives the extra cost in a
  line and the shared citation.
- **Already linked**: a relation the files already record (`blocked_by`, `from`, a `Folded into`
  section). Listed so it is not mistaken for news.

## The brief

```
Scan the On Foot worklist for overlaps with one subject. Read only; change no file.

Subject: <the ticket's path, or the pitch in full: what it changes, and the files and functions it
would touch>

Read every file under docs/tickets/ and every work item (NN-*.md) under docs/design/plans/*/, end
to end. For a candidate collision, also read the spec or ADR it would break: a ticket's `from`
names it, and docs/adr/ holds the ADRs. Bucket each overlap with the subject, per the bucket
definitions in .claude/skills/scan-tickets/SKILL.md (## The buckets). Return:

read: <n> ticket files, <n> work items
same | collides | folds in | already linked:
- T-<n> <title>: <the overlap in one line> (<shared file:line, or the ruling quoted>)

An empty bucket reads `none`. A hit carries its evidence; a shared area folder alone is no hit.
```
