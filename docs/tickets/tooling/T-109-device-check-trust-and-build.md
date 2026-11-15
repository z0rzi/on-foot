---
severity: should-fix
category: enhancement
size: M
triage:
origin: owner
filed: 2026-11-15
from: "[[2026-11-15-device-check-speed-rerun]]"
blocked_by: []
---
# T-109: a device check cannot tell which build is on the phone, and still sends raw key presses

Two gaps of the device-check toolkit, both seen in the measurement of
[[2026-11-14-device-check-speed-design]]: they cost the most wall time, and they are what the
Sonnet trial broke, so the model was not adopted.

**Build identity.** `build-has` (`tools/device-check/buildHas.ts`) answers only whether the
installed JS bundle holds a string the change introduced. A change with no new string, T-49's
hydration fix for one, cannot be proved on the phone. The Opus re-run of 2026-11-14 built and
installed a release for that reason alone (about 20 min of its 58.5). The Sonnet trial of
2026-11-15 skipped the build and claimed T-49 "by install date", which names no commit; its
verdict held only because the installed APK happened to be the re-run's `c7f942b`. If the bundle
carried the commit it was built from, the preflight could say "installed = X, contains Y" for any
change on master, and a build would be needed only when the installed commit lacks it. The app
logs `launch cold start {"appVersion":"1.0.0"}` (`src/log/deviceInfo.ts`), which says nothing of
the build.

**Leaving the app.** The toolkit has `back`, `type` and `scroll` behind its foreground guard, but
no way home. The Sonnet trial left On Foot with the raw Home key three times, outside the guard
that keeps a check's key presses away from the owner's other apps; the skill allows raw `input`
only for the app switcher and waking the screen. The Opus re-run went through the app switcher.

Feature-sized: goes brainstorm → spec → plan, this ticket then points at the spec. After it lands,
the same check is run once more by a cold Opus and a cold Sonnet, with the waits the claims require
counted the same way, for the speed-up figure the first measurement could not give and the model
decision of the speed spec's item 07.
