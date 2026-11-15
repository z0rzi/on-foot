---
severity: should-fix
category: enhancement
size: M
triage:
origin: agent
filed: 2026-11-15
from: "[[2026-11-15-device-check-speed-rerun]]"
blocked_by: []
---
# T-110: a JS-only change waits on a full release build before its device check

The release build is the largest single cost of a device check: about 20 of the re-run's 58.5 min
in [[2026-11-15-device-check-speed-rerun]], and as much in the original it was set against. The
skill's preflight has one way to put a change on the phone,
`npx expo run:android --variant release --no-bundler` (`.claude/skills/device-check/SKILL.md`,
step 1), which runs the whole native build. Most changes touch only JS, and for them the native
half of the APK is the one already installed.

`android/` is generated and gitignored, so a fresh worktree has none and starts from prebuild and a
cold Gradle tree. The release is signed with `android/app/debug.keystore`
(`android/app/build.gradle:108`), a key on this machine.

A JS-only path could bundle the JS, compile it to Hermes bytecode, put it in place of
`assets/index.android.bundle` in the installed build's APK, re-sign it with the same key and
`adb install -r` it: about a minute or two, against twenty. Not measured. It is safe only when the
native side is unchanged, which is what `@expo/fingerprint` hashes: the fingerprint of the
installed build against the change's decides between the JS-only path and the full build. The
installed build has to carry its fingerprint for that, as T-109 has it carry its commit; the two
stamps are one design question.

What a design has to settle: where the base APK comes from (pulled from the phone, or kept on the
host from the last full build), how the toolkit refuses the JS-only path on a fingerprint mismatch
rather than installing a bundle against the wrong native code, and how the report names a build
made that way.

Feature-sized: goes brainstorm → spec → plan, this ticket then points at the spec.
