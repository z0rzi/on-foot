# Native patches

Two Expo modules are patched with `patch-package`. `postinstall` applies both, so a fresh `npm
install` is enough — but a patch is invisible debt: it silently stops applying when the dependency
moves. **Each entry here says what breaks if the patch is dropped, so the next person upgrading knows
what to re-test.**

Both patches are to Android native sources in `node_modules`. That is the only lever available: the
modules ship Kotlin/Java that Gradle compiles from `node_modules`, and `android/` itself is generated
by `npx expo prebuild` and gitignored.

## `expo-task-manager+57.0.12.patch`

`TaskManagerUtils.createJobInfo`: `setPersisted(true)` → `setPersisted(false)`.

Expo registers the background-location delivery as a persisted `JobScheduler` job. A persisted job
requires `RECEIVE_BOOT_COMPLETED`, and on some OEMs the persisted job crashed background location
outright. The only capability lost is a recording surviving a device reboot, which the app does not
promise. Designed in
`docs/superpowers/specs/2026-08-22-onfoot-rn-record-activity-design.md` (§ the permission's
"belt-and-suspenders" note).

**If dropped:** background location may crash on affected OEMs, and the `RECEIVE_BOOT_COMPLETED`
permission in `app.config.ts` becomes load-bearing again.

## `expo-location+57.0.11.patch`

`LocationTaskConsumer.didReceiveBroadcast`: guard the `lastLocation` completion listener with
`task.isSuccessful` before reading `task.result`.

For a broadcast that carries no location result, the module falls back to
`mLocationClient.lastLocation` and reads `task.result` inside the completion listener. That listener
runs **after** `didReceiveBroadcast` returns, so the surrounding `try/catch (SecurityException)` is
no longer on the stack — and `Task.getResult()` rethrows the task's failure wrapped in a
`RuntimeExecutionException`. Once the user revokes the location permission, a delivery already in
flight therefore reaches the callback thread as an uncaught exception and kills the process.

Observed in the field as `FIELD-4` in `docs/reviews/2026-09-10-full-review.md` §5.1
(`SecurityException` at `LocationTaskConsumer.kt:89`, via `adb shell dumpsys activity exit-info` and
dropbox crash entries). The patch logs the failure the way the existing synchronous `catch` does and
returns, leaving the outer `try` in place for the throw that *can* still happen synchronously when
the `lastLocation` getter is called.

**If dropped:** revoking the location permission during or shortly after a recording can kill the
process instead of stopping capture cleanly.

Not reported upstream yet.

## Checking a patch actually reached the build

A patch that applies to `node_modules` is not the same as a patch that is compiled into the APK — on
2026-10-04 a build made two days after the expo-location patch was applied still crashed at upstream's
line number, and nothing in the source tree explained it. So each patch carries a **marker string**
that exists only in the patched version, and a build can be checked rather than assumed:

```bash
APK=android/app/build/outputs/apk/release/app-release.apk
for d in $(unzip -Z1 $APK 'classes*.dex'); do unzip -p $APK $d | strings -a | grep -c '\[onfoot-patch\]'; done
```

A zero total means the build did not take the patch, whatever `node_modules` looks like. The marker is
also what appears in logcat when the guarded path runs, so the same string proves it on a device:

```bash
adb logcat -d | grep onfoot-patch
```

Add a marker to any new patch, and keep it out of the hot path — it is a diagnostic, not a feature.

## Upgrading a patched module

1. Bump the dependency. `postinstall` will fail loudly if a patch no longer applies — that failure is
   the signal, not a nuisance.
2. Read the module's new source at the patched site. If upstream fixed it, delete the patch and this
   entry.
3. If it is still broken, regenerate: edit the file in `node_modules`, then
   `npx patch-package <module>`, and delete the old patch file (its name carries the old version).
4. Native changes are device-verified — neither patch is reachable from Jest.
