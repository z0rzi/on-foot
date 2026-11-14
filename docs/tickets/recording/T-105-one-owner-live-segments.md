---
severity: should-fix
category: refactor
size: S
triage: ready-for-agent
origin: agent
filed: 2026-11-14
from: "DUP-1 in [[2026-11-14-full-review]]"
blocked_by: ["[[T-95-new-recording-takes-no-fixes]]"]
---
# T-105: the live track is grouped into segments by four owners

The recording store keeps the live track as flat points with a `segment` value
(`src/recording/recordingStore.ts:32`). Four consumers each derive the same `TrackPoint[][]` with
`groupPointsBySegment` (`src/data/activities/mapping.ts:72`), once per fix batch:
`src/map/MapCanvas.tsx:88`, `src/map/profileSource.ts:21` (through `useRouteDisplay`),
`src/recording/usePersonalFactor.ts:11` and `src/recording/RecordingFigures.tsx:25`.

`CODING_STANDARDS.md` "Derived or cached state has one owner". A fifth consumer will copy whichever
site it opens first. The cost is not the concern: at the 10 m minimum distance and 15 s batches, a
20 km hike is about 2,000 points and the four passes are sub-millisecond.

**Why it waits for T-95.** The process-death spec drafted from T-95
([[2026-11-14-recording-survives-process-death-design]]) changes how `livePoints` is filled after a
relaunch. The owner of the segments belongs to that design: in its `## Existing shape`, or built
right after it lands. Built first, it would be reworked.

## Agent Brief

**Category:** refactor
**Summary:** One owner for the live track's segments; the four consumers read it.

**Desired behavior:**
- Either a `useLiveSegments()` selector in `src/recording/`, memoised on `livePoints`, or the
  segmented shape kept in the store beside the flat list. Choose by what the process-death design
  does to `livePoints`, and write the reason in the commit.
- The four sites read it, and none imports `groupPointsBySegment` for the live track.

**Acceptance criteria:**
- [ ] One derivation of the live segments in the codebase.
- [ ] A test of the owner: a segment break, an empty track, and a pause.
- [ ] `npm run verify` green.

**Out of scope:**
- `groupPointsBySegment` on stored activities (`mapping.ts`), which is not live state.
