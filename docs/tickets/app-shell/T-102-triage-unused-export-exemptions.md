---
severity: minor
category: refactor
size: M
triage:
origin: agent
filed: 2026-11-14
from: "DEAD-1 in [[2026-11-14-full-review]]"
blocked_by: []
---
# T-102: 86 unused-export exemptions carry the placeholder rationale `'pre-existing, triage'`

The unused-export gate (`c527106`) exempted every export it found unused on the day it landed, under
`PRE_EXISTING = 'pre-existing, triage'` (`src/architecture/unusedExports.ts:18`). 86 entries use it.
The largest groups are `src/data/activities/mapping.ts` (7) and `src/elevation/trailProgress.ts` (5).

The review sampled 19 of them, and each one was a test seam rather than dead code: used inside its own
file and imported by its test (`computeMetrics`, `slopeBands`, `toLocationFix`, `flushLog`, and the
re-export at `src/map/providers/mapbox/capabilities.ts:3`, imported only by `capabilities.test.ts`).
The gate already has honest rationales for that shape (`FIXTURE_TYPE`, `HOOK_CORE`, `MAPPING_CORE`,
`:19-21`). While the placeholder looks like a rationale, a careless new entry reads the same as these 97.

Each entry gets one of three outcomes:
- a test seam keeps its exemption, under a rationale that says so (an existing constant, or a new
  "tested directly" one);
- a test that can go through the public function does, and the `export` goes;
- an export nothing reaches is deleted.

Done when `PRE_EXISTING` is gone.
