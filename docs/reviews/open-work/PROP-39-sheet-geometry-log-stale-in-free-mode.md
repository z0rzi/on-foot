---
severity: minor
category: bug
size: S
triage: needs-triage
source: "device check, 2026-10-26"
blocked_by: []
---
# PROP-39: the `app active` geometry entry reports a stale sheet edge in free mode

Seen during the PROP-8 device check. With a trail sheet open, the entry is right:
`{"mode":"trail","windowHeight":941,"sheetTop":736,"rootHeight":876,"graphBottom":140}` — 736 dp
is the handle's top (1877 px / 2.55), 876 is the window less the 65 dp tab bar. After exiting the
trail view and resuming again, the free-mode entry is identical:
`{"mode":"free","windowHeight":941,"sheetTop":736,"rootHeight":876,"graphBottom":140}`, though no
sheet is on screen.

`src/map/MapScreen.tsx:134` mounts `MapInfoSheet` only while `sheetContent` is non-null, so in free
mode the sheet is gone and nothing writes `sheetTop` (line 44) again: it keeps the edge of the last
sheet. `graphBottom` derives from it. The comment in `src/map/useSheetGeometryLog.ts:30` reads
`sheetTop === windowHeight` as "the sheet never left", which holds only until the first sheet
closes.

No visible effect today: in free mode `MapControls` and `RecordButton` get no `animatedBottom`
(`MapScreen.tsx:103,111`). The cost is the log: an entry meant to diagnose sheet placement
(FIELD-2) states a sheet edge that does not exist. It is also worth checking whether a sheet that
mounts next starts from the stale value for a frame; the comment at `MapScreen.tsx:71-74` describes
that class of handover for FIELD-2. Evidence: `.scratch/device-checks/2026-10-26/A/06-debuglog.*`.
