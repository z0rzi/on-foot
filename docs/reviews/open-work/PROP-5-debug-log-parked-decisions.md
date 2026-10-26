---
severity: investigate
category: enhancement
size:
triage: ready-for-human
source: debug-log work
blocked_by: []
---
# PROP-5: debug-log decisions parked for a human

- `src/log/index.ts` is a half-barrel five consumers bypass.
- The viewer has no area filter while `fix batch` is ~95% of entry volume.
- The three sheet-geometry reads are not collapsed into one `runOnUISync`.
- A migration-failure launch cannot be logged at all.

## Why a human

Each bullet is a design choice (barrel or not, an area filter in the viewer, batching sheet reads,
logging before the database exists), not a defect with an obvious fix. Split each into its own
ticket once decided.
