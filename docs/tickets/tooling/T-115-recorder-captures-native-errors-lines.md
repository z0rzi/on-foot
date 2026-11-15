---
severity: minor
category: enhancement
size: M
triage:
origin: agent
filed: 2026-11-15
from: "[[2026-11-15-app-log-capture-design]]"
blocked_by: []
---
# T-115: native errors still live only in logcat's buffer, which rotates in under a minute

The recorder keeps only the debug-log mirror's lines (`-s ReactNativeJS`, `OnFootLog`). `devcheck
native-errors` still reads logcat itself (`tools/device-check/nativeErrors.ts:18`), and at the
phone's default 256 KiB buffer that holds about 45 s, so a Mapbox source or layer error, an RNMBX
error or a FATAL crash at launch is gone by the time a check reads it a minute later. The capture
spec set this aside as a follow-up. Recording the tags `native-errors` reads (`Mapbox`, `RNMBX*`,
`ReactNativeJS` errors, `AndroidRuntime`) beside the mirror would make both commands views of one
capture; `-s` takes no wildcard, so `RNMBX*` needs another filter (the app's uid, or a tag list).
