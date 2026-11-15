# Briefing a device check

For the agent that dispatches a device check. You hold the change in context; the agent you
dispatch starts cold and spends its first minutes rebuilding what you know (the re-run of
2026-11-14 read code and docs 30 times before and between its phone calls). Hand it a **check
plan**, so its run starts at the phone.

The brief names the `device-check` skill and carries the plan. The skill's rules hold over the
brief: the plan says what to check and how to reach it; what is allowed stays the skill's.

## The check plan

- **Build.** A string `devcheck build-has` finds only in a bundle holding the change (a log message
  or a label; Hermes drops constant names), copied from the source, and the commit the build must
  hold. A change to native code, or one with no such string, says so: the agent builds.
- **Each claim**, in the order to run them:
  - the claim, with its ticket or spec;
  - the expected observation in the words the phone shows: a log entry as area, message and detail
    keys, from its `logEvent` call (`file:line`); a label, from its `accessibilityLabel`. Copy them
    from the source;
  - the steps that reach it, as `devcheck` command lines or one `do` list, each move with its pace;
  - what `failed` looks like, when it is more than the expected observation missing;
  - the waits the claim sets itself (an app timer, a stretch in the background), with their length;
  - the part that is feel, marked `owner to verify`.
- **Files to read**: the changed files, by path, for when a step does not go as the plan says.

Order the claims so that a long wait (a walk, an app timer) runs in the background while the
claims it does not disturb run on the phone.

The plan is a starting script: the agent runs it, trusts the screen in front of it over the plan,
and reports where it departed from it. Done when every claim has an expected observation copied
from the source and steps that reach it.
