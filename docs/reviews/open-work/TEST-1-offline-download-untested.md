---
severity: minor
category: enhancement
size: S
triage: ready-for-agent
source: "[[2026-09-10-full-review]]"
blocked_by: []
---
# TEST-1: offline download helpers untested

Partly closed (`4157735`). `formatBytes` is tested and moved to `src/format/units.ts`.
`packDescriptor` and lifting `guardDownload`'s decision order into a pure
`downloadDecision(status, freeBytes, estimate)` remain untested and open.

## Agent Brief

**Category:** enhancement
**Summary:** Test `packDescriptor`, and lift `guardDownload`'s decision order into a pure, tested `downloadDecision`.

**Current behavior:**
`packDescriptor(trailId, style, bounds)` has no test. `guardDownload(estimatedBytes, proceed)` reads
connectivity and free disk space, then decides in order: offline → refuse; not enough space →
refuse; metered → ask; otherwise proceed, failing open on probe errors. The order lives inside the
async function, mixed with `Alert` and `logEvent` calls, and is untested.

**Desired behavior:**
A pure `downloadDecision(status, freeBytes, estimate)` returns the outcome (`offline`, `no-space`
with the needed and free bytes, `ask-metered`, `proceed`). `guardDownload` probes, calls it, and
maps the outcome to its alerts and logs, with behaviour unchanged. Both pure functions are written
test-first.

**Key interfaces:**
- `downloadDecision(status, freeBytes: number | null, estimate: number | null)`: new, pure.
- `guardDownload(estimatedBytes, proceed)`: same signature and behaviour.
- `packDescriptor(...)`: unchanged, newly tested.

**Acceptance criteria:**
- [ ] Tests cover offline first, no-space before metered, metered, proceed.
- [ ] Unknown free space (`null`) and unknown estimate (`null`) proceed past the disk check (fail-open).
- [ ] `packDescriptor` has tests for its id and bounds.
- [ ] `guardDownload`'s user-visible alerts and log lines are unchanged.

**Out of scope:**
- Changing any threshold, message or log text.
- The connectivity gate `evaluateDownloadGate` itself.
