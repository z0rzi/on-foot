---
severity: minor
category: bug
size: S
triage: ready-for-agent
origin: agent
filed: 2026-11-07
from: "device check, 2026-11-07"
blocked_by: []
---
# T-66: the download percentage goes backwards when one layer of a two-layer download finishes

Seen on the round-2 device check of `hiking-ux` (release build): a trail's offline map downloaded
with both layers ticked (Default ~5 MB, Satellite ~17 MB) showed the sheet's badge at 44 %, then
24 % once the Default pack finished. Evidence: `.scratch/device-checks/2026-11-07-round2/`
`22-chooser-two-layers.png`, `23-download-toast-frame20.png`, `23b-download-toast-frame21.png`,
`24-download-done-sheet-open.png`.

Cause: `offlineStatusForTrail` (`src/map/offline/status.ts:25-28`) shows the mean percentage of the
trail's *live, unfinished* packs only. When a pack completes, `offlineStore`'s `track` clears its
live progress (`clearProgress(id)`, `src/map/offline/offlineStore.ts`), so it leaves the mean and
the badge drops to the remaining pack's own percentage: 64 % and 24 % average to 44 %, then 24 %
alone. The at-rest fallback (`status.ts:31-39`) averages the same way.

Pre-existing: `status.ts` and the progress clearing are identical on `master`. T-53's
`downloadBatches` (`src/map/offline/downloadBatches.ts`) only added the settle events behind the
"downloaded" toast and does not touch the percentage. It does now know which packs one download
started together, which is the grouping this fix needs.

## Agent Brief

**Category:** bug
**Summary:** A trail's download percentage never goes down while one download of several packs runs.

**Current behavior:**
The badge and the "Downloading … · n %" line average only the packs still downloading, so a pack
finishing drops it from the average and the figure falls.

**Desired behavior:**
A pack that finished counts as 100 % until every pack of the same download has settled, so the
figure only rises. Decide whether to weight by pack size; the chooser already shows a size estimate
per layer (`~5 MB`, `~17 MB`), so check whether it reaches `status.ts` before choosing an
unweighted mean.

**Acceptance criteria:**
- [ ] A test, red first, on `offlineStatusForTrail` (or the pure piece that replaces it): two packs
      at 64 % and 24 %, then the first complete, never reports less than before.
- [ ] A single-pack download and a resumed pack report as today.
- [ ] `npm run verify` green; the device check (two layers) is listed as owed.

**Out of scope:**
- The download toast and its batching (T-53).
