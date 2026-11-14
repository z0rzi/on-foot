---
status: open
blocked_by: ["[[02-recording-and-moving-walk-readable]]"]
closes: []
---
# 03: `tap` waits for settled and reports what it caused

**What to build:** `tap <label> [--hold MS] [--until <label> | --until-gone <label>] [--timeout S]`
reads until its target's bounds agree across two reads, taps, then waits either for the named
outcome or for the screen to settle, and prints the labels of the screen it ended on. A screen
identical before and after prints "nothing changed". A named outcome that does not come fails with
the time waited and the labels last seen; a target still moving at the cap refuses the tap; a
screen that never settles prints its last read as "not settled" without failing. Settled is the
toolkit's own rule, a pure function of two reads: agreement on the target's bounds before a tap,
on the set of labels and their bounds after. The settle wait and the tap outcome go through the
one polling loop `wait-for` already uses, with the judge as the only difference. The delete flow's
fixed settle sleep is replaced by the rule. As the prefactor, the command functions return their
result and the CLI prints it, so the flows and, later, `do` compose them. The intervals and the
cap are constants set on the device.

- [ ] Prefactor first, with no change in output: commands return their result, the CLI prints
- [ ] The settled rule: equal reads agree; a moved target does not; a changed clock text with
      equal bounds agrees for a target and not for the full label set; the cap gives "not
      settled" (tests)
- [ ] The tap outcome: appeared, gone, nothing changed, timed out with the labels seen (tests)
- [ ] A fixture of a sheet mid-animation, captured with the server (tests)
- [ ] Skill: the command table carries the new `tap` options and what `tap` prints
- [ ] Device: a tap on a control of a sheet while it opens lands; `tap --until` on a screen that
      takes over a second to come, and on one that never comes; `--until-gone` on a dialog; a tap
      that changes nothing says so; on the recording screen, where the clock ticks, a tap settles
      inside the cap; `cleanup` deletes a `DEVCHECK` item without the fixed sleep
- [ ] `npm run verify` green
