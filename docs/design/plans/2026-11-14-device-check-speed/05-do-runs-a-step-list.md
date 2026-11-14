---
status: open
blocked_by: ["[[03-tap-waits-for-settled-and-reports]]", "[[04-labels-back-and-type]]"]
closes: []
---
# 05: `do` runs a step list

**What to build:** `do <step>...` runs several steps in one command. Each argument is one step,
written as the command line the toolkit takes and split by one pure parser. Allowed: `tap`,
`wait-for`, `labels`, `shot`, `frames`, `crop`, `zoom`, `back`, `type`. Refused as steps, with the
reason: `walk`, `import-gpx`, `save-activity`, `delete`, `cleanup`, `build-has` and `do` itself.
Every step is parsed before the first runs, so a faulty or refused step stops the list before the
phone is touched, named with its position. Steps run in order in one process, the foreground guard
before each; each prints a header naming it, then its own output. The first failure ends the list
with that step's exit code and the count of steps not run, so `phone gone` stays distinguishable.

- [ ] The step parser: quoting, options, an unknown or refused step named with its position, an
      empty list refused (tests)
- [ ] The runner's plan: order kept, stop at the first failure, the failing step's exit code, the
      count not run (tests)
- [ ] Skill: the command table gains `do` with one example
- [ ] Device: a five-step list ending on `labels` in one command; a list whose third step fails,
      steps four on not run, the exit code the step's own; a list with a malformed fourth step,
      nothing run; a step that brings another app in front stops the list
- [ ] `npm run verify` green
