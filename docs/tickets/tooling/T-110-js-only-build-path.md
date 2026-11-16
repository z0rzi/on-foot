---
severity: minor
category: enhancement
size: M
triage:
origin: agent
filed: 2026-11-15
from: "[[2026-11-15-device-check-speed-rerun]]"
blocked_by: []
---
# T-110: a JS-only change still waits on a release build before its device check

The release build was the largest single cost of a device check: about 20 of the re-run's 58.5 min
in [[2026-11-15-device-check-speed-rerun]], and as much in the original it was set against. Timed
on 2026-11-16 (Gradle profiles, `master` at `5b4c865`), most of it was native code compiled for
four architectures when the phone needs one:

| Release build | Gradle |
|---|---|
| fresh worktree (prebuild, no `android/`), 4 architectures, no build cache | 10 m 16 s |
| fresh worktree, 4 architectures, build cache warm | 7 m 46 s |
| fresh worktree, `arm64-v8a` only, build cache warm | 3 m 05 s |
| a warm `android/` copied into a fresh worktree, `arm64-v8a` only | 2 m 36 s |
| the same worktree again through `expo run:android`, nothing changed, `arm64-v8a` only | 21 s (44 s with the CLI) |

- `expo run:android` already passes `--build-cache`. It narrows the architectures to the phone's
  only on a debug build; a release compiles every one in the generated `gradle.properties`
  (`armeabi-v7a,arm64-v8a,x86,x86_64`). The app's own C++ (`:app:buildCMakeRelWithDebInfo`) took
  75 to 92 s per architecture, and Gradle's build cache does not cover CMake tasks.
- `devcheck build` now sets `ORG_GRADLE_PROJECT_reactNativeArchitectures` to the phone's first ABI
  React Native builds for (`tools/device-check/buildArchitecture.ts`), which leaves the generated
  project and the native fingerprint unchanged.
- A copied `android/` keeps Gradle's tasks up to date (798 of 947) but not the app's CMake build,
  whose caches hold the checkout's absolute paths: it rebuilt in 77 s, so the copy saved 30 s for
  1.2 GB per worktree. A symlinked `android/` would share one output folder between worktrees, and
  `app/build.gradle` takes the project root from its parent, so neither is done.

What is left for a JS-only change is a release build in a worktree that has built before: a minute
or two, about 30 s of it the JS bundle (`:app:createBundleReleaseJsAndAssets`), plus 3 minutes
more the first time in a fresh worktree. Not timed: a JS change on the warm worktree, and the
whole `devcheck build` with the phone's install.

A JS-only path could still bundle the JS, compile it to Hermes bytecode, put it in place of
`assets/index.android.bundle` in the installed build's APK, re-sign it with
`android/app/debug.keystore` (`android/app/build.gradle:108`) and `adb install -r` it, when the
installed build's native fingerprint (`state`, [[2026-11-15-check-hooks-design]]) matches the
working tree's. Against the figures above it would save about a minute on a warm worktree and the
prebuild and native build of a fresh one. What a design has to settle: where the base APK comes
from (pulled from the phone, or kept on the host from the last full build), how the toolkit
refuses the JS-only path on a fingerprint mismatch rather than installing a bundle against the
wrong native code, and how the report names a build made that way.

Feature-sized: goes brainstorm → spec → plan, this ticket then points at the spec.
