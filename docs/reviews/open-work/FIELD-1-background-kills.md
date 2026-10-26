---
severity: should-fix
category: bug
size:
triage: ready-for-human
source: "[[2026-09-10-full-review]]"
blocked_by: []
---
# FIELD-1: the system kills the app in the background

Investigate. The most interesting thing left. Every data point says **memory, not CPU**: the one
excessive-CPU kill was ~3.9% against a 2% cap, while the footprint runs 474-512 MB pss / 595-624 MB
rss across every sample.

The finding has been redirected twice by evidence. The original question — what burns CPU while
cached — was wrong. The second answer, "it tracks what a *recording* retains", is **also wrong**:
`dumpsys meminfo` on 2026-10-07 at 16:23, with the app merely showing a map and **not recording**,
read 474 MB pss / 595 MB rss — Native Heap 199 MB, Graphics 125 MB, Dalvik 15 MB. A recording adds
only tens of MB on top of that.

So the bulk is the map SDK's tiles and textures, resident whenever the map is open, and
`livePoints` is no longer the first suspect. Next step: sample `meminfo` with the map closed (on
the Trails or Settings tab) to separate the map's share from the rest, and check whether Mapbox's
tile cache is bounded in this app's configuration.

## Why a human

Device-only: the next step is `dumpsys meminfo` sampled with the map closed (Trails or Settings
tab) and with it open, on the physical phone. An agent has no device. After that, whether to bound
Mapbox's tile cache is a decision for the owner.
