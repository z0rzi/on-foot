---
description: Post-work quality control on the current unit of work
---

# Retro-Quality — post-work quality control

Run this after finishing a unit of work (a task, feature, or fix), **before** declaring it
done or merging.

Read `AGENTS.md` (its "Architecture principles" are the standard you check against) and
`POST-WORK.md`, then perform the post-work quality control **exactly as `POST-WORK.md`
describes**: scope to what *this iteration* changed, read every changed file in full, run
each numbered check, run the gates (and the seam greps), and produce the report.

`POST-WORK.md` is the single source of truth for the checklist and gates — follow it, don't
restate it here. Structure the report around its numbered checks (a check with no line was
not done), then **stop and ask** before applying fixes, except unambiguous cleanup (dead
code, a stray debug log, a lint/type error) which you may fix directly and note. Re-run the
gates after any fix.

## Then

Follow up with `/if-from-zero`.
