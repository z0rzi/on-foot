---
severity: minor
category: bug
size: S
triage: ready-for-human
source: "[[2026-09-10-full-review]]"
blocked_by: []
---
# FIELD-3: the interruption toast is hidden, and its range overstates the gap

The toast fires behind the splash, and its range starts at the last stored point rather than the
gap's real start. The debug log records the announced range, so a fix can be checked against real
field data instead of a guess.

## Why a human

Two things an agent cannot settle: what the gap's "real start" is (last stored point, last
received fix, or the moment tracking stopped), which is a product decision; and toast timing behind
the splash, which only shows on a device. Once the start is decided, the range computation is
agent-able as a TDD'd pure function.
