---
status: open
blocked_by: ["[[05-do-runs-a-step-list]]"]
closes: []
---
# 06: the skill drives with `labels`, `tap --until` and `do`, and the gain is measured

**What to build:** the skill's "Looking and driving" is rewritten as one way to look and drive:
read with `labels`, take a `shot` when the claim is about pixels, act with `tap --until`, batch
with `do`; no fixed sleep after a tap. The steps and the rules are read end to end for anything the
earlier items left stale. Then one earlier device check, chosen from `.scratch/device-checks/` with
its brief and transcript at hand, is run again end to end by a fresh agent following the new skill,
and its wall time, turn count, image reads and written sleeps are set against the original's in a
short report under `docs/reviews/`. A fall-back to `tap; sleep; shot` in that run is a finding
about the skill's wording, fixed here.

- [ ] Skill: Looking and driving rewritten; no line left that describes the dump's idle wait, the
      unreadable recording screen or raw key events for back and text
- [ ] The toolkit's usage text and the skill's command table list the same commands and options
- [ ] The toolkit spec's status line says its reader was replaced, pointing at this spec; this
      spec's status line says built
- [ ] Device: the re-run check reaches the original's verdicts; the report gives both runs'
      figures and how they were counted
- [ ] `npm run verify` green
