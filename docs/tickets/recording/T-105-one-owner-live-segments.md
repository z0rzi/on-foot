---
severity: should-fix
category: refactor
size: S
triage: ready-for-agent
origin: agent
filed: 2026-11-14
from: "DUP-1 in [[2026-11-14-full-review]]"
blocked_by: []
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

The process-death design ([[2026-11-14-recording-survives-process-death-design]]) keeps `livePoints`
flat and replaces it when the relaunch hydrates; only the segment a relaunch continues changes. The
owner of the segments does not depend on it.

## Agent Brief

**Category:** refactor
**Summary:** One owner for the live track's segments; the four consumers read it.

**Desired behavior:**
- Either a `useLiveSegments()` selector in `src/recording/`, memoised on `livePoints`, or the
  segmented shape kept in the store beside the flat list. Write the reason for the choice in the
  commit.
- The four sites read it, and none imports `groupPointsBySegment` for the live track.

**Acceptance criteria:**
- [ ] One derivation of the live segments in the codebase.
- [ ] A test of the owner: a segment break, an empty track, and a pause.
- [ ] `npm run verify` green.

**Out of scope:**
- `groupPointsBySegment` on stored activities (`mapping.ts`), which is not live state.
