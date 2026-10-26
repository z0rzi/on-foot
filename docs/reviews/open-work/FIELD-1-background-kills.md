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

## Comments

> *Comment written by an AI agent.*

Owner ruling 26/10 → `ready-for-human`. Stays human for a hardware reason: the owner will plug in the phone for an adb session where an agent samples `dumpsys meminfo` with the map closed (Trails or Settings tab) and then open. Whether to bound the Mapbox tile cache is decided on those numbers, not before. No blind cache bound.

> *Comment written by an AI agent.*

adb session of 26/10 (release build of HEAD, phone still, not recording). `dumpsys meminfo`, in kB:

| step | PSS | RSS | Native Heap | Graphics | Dalvik |
|---|---|---|---|---|---|
| Map, 60 s | 366773 | 495600 | 139100 | 98396 | 16684 |
| Trails, 60 s | 373080 | 502232 | 141356 | 95280 | 22540 |
| Settings, 60 s | 368138 | 497460 | 140012 | 95260 | 19750 |
| Map, 60 s | 352729 | 481864 | 139660 | 102484 | 14908 |
| Map after zoom + pan | 403194 | 532328 | 172584 | 111444 | 20946 |
| Trails, 60 s | 390270 | 519388 | 173468 | 97452 | 21274 |
| Background, 90 s | 350608 | 479708 | 152072 | 83936 | 16595 |

Leaving the map tab frees almost nothing. The expo-router tabs have neither `unmountOnBlur` nor
`freezeOnBlur` (`app/(tabs)/_layout.tsx`): the `MapView` is detached from the window, not destroyed,
and keeps its native heap. Pan/zoom adds ~33 MB native that does not come back on Trails; only
backgrounding returns part of it (−21 MB native, −14 MB graphics). No tile cache is bounded in the
app: no `setMaximumAmbientCacheSize` and no tile store setting in `src/` or `app.config.ts`, so SDK
defaults (`@rnmapbox/maps` 10.3.5). The numbers are lower than the 474 MB of 07/10: no tiles were
loaded beyond the starting area. Evidence: `.scratch/device-checks/2026-10-26/A/mem-*.txt`.
