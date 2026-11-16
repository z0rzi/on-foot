# Briefing a device check

For the agent that dispatches a device check. You hold the change in context; the agent you
dispatch starts cold and spends its first minutes rebuilding what you know (the re-run of
2026-11-14 read code and docs 30 times before and between its phone calls). Hand it a **check
plan**, so its run starts at the phone.

The brief names the `device-check` skill and carries the plan. The skill's rules hold over the
brief: the plan says what to check and how to reach it; what is allowed stays the skill's.

## The check plan

For a plan, the claims come from its final check (`docs/agents/issue-tracker.md`, Plan work
items): its `Device:` lines, put in run order, with its waits and feel items.

- **Build.** The commit the build must hold, for `devcheck build-has --commit` (`HEAD` when the
  change is uncommitted in the checkout the agent runs from).
- **Each claim**, in the order to run them:
  - the claim, with its ticket or spec;
  - why only the device can show it: rendering, OS or lifecycle behaviour, a native module, or
    what survives a kill. A claim the Jest suite answers has no such reason: drop it, or read its
    result once in a state the check reaches anyway, on the data the other claims already make
    (walking 2.4 km of history for the personal factor, whose arithmetic its tests hold, cost one
    check 50 minutes);
  - the expected observation in the words the phone shows: a log entry as area, message and detail
    keys, from its `logEvent` call (`file:line`); a label, from its `accessibilityLabel`. Copy them
    from the source;
  - its stage, as hook commands: the `DEVCHECK` trail or agent session it needs (`route` and
    `import-gpx`, `record …`), what the map shows (`select`), the state to confirm first (`state`);
  - the steps that observe it by its cheapest evidence, as `devcheck` command lines or one `do`
    list: the screen only for what the claim is about; `fast` or a jump unless the claim reads
    pace (the skill's Pace says what does); the shortest dead or background stretch that still
    shows the behaviour; one theme, one map layer and one font scale unless the claim is about
    them;
  - what `failed` looks like, when it is more than the expected observation missing;
  - the waits the claim sets itself (a walk at `walk` pace, an app timer, a stretch dead or in the
    background), with their length;
  - the part that is feel, marked `owner to verify`.
- **Owed claims**: the entries of `docs/tickets/device-checks.md` the same build reaches, each
  written as a claim like the others and placed in the run order.
- **Waits**: every claim's waits, owed claims' among them, and their total. Read the total before
  dispatching: it is time the run spends on the clock whatever the phone does, so a wait a
  cheaper evidence would replace is cut here.
- **Files to read**: the changed files, by path, for when a step does not go as the plan says.

Order the claims so that a long wait (a walk, an app timer) runs in the background while the
claims it does not disturb run on the phone.

**A re-check brief** after a defect's fix lists only the claims that failed and those the fix can
touch, on one build holding the fix. After the phone dropped off, the re-dispatch lists only the
claims left `blocked`.

The plan is a starting script: the agent runs it, trusts the screen in front of it over the plan,
and reports where it departed from it. Done when every claim has its reason, an expected
observation copied from the source, its stage, and steps by its cheapest evidence, the waits
carry their total, and `docs/tickets/device-checks.md` has been read for owed claims.
