---
severity: investigate
category: bug
size:
triage: needs-info
origin: agent
filed: 2026-11-15
from: "[[2026-11-14-recording-survives-process-death-design]]"
blocked_by: []
---
# T-116: a relaunch run at the unlock fails to start capture once, then recovers

Seen once, in the process-death device check of 2026-11-15 (release build of `ffcba43`, mock walk,
`.scratch/device-checks/2026-11-15/item04/debuglog-capture.txt`). The app was opened at 19:19 while
the phone was locked: logcat shows `Running "main"` at once, but the relaunch ran only at the unlock,
11 minutes later. In the debug log, all at 19:30:07: `launch cold start` (`runtimeAgeMs` 1282166),
`launch detected an interruption {"from":"19:16","to":"19:30"}`, `capture stream start failed
{"errorClass":"Error"}`, `launch launch action resume`, then `capture recovery re-issued the stream`
and `capture stream live`. Deliveries went on afterwards.

The failure comes from `issueStream` (`src/recording/recordingController.ts:45`), called by
`resumeAfterProcessDeath` to restart capture. `errorClass` gives only `Error`, so the native cause is
not known. One guess, not checked: Android refuses to start the foreground service while the
activity is not yet in front. The recovery path covered it this time; a failure the recovery does
not catch would leave the recording without a live stream.

## Triage Notes

> *Comment written by an AI agent.*

Arbitrage utilisateur 15/11 → `needs-info`. Ticket à investiguer. On attend une reproduction : ouvrir
l'app derrière le verrou pendant un enregistrement, déverrouiller, et lire le message natif de
l'erreur dans logcat ([[T-101-error-class-carries-native-code]] donnerait le code dans le journal).
