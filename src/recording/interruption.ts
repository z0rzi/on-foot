import { formatClockTime } from '../activities/format'

// The span a dead process left without positions: from the last stored point (or the session start
// when nothing was captured) to the relaunch. It says what is missing, not when the process died.
export interface InterruptionGap {
  since: number
  until: number
}

export function interruptionMessage(gap: InterruptionGap): string {
  return `No position between ${formatClockTime(gap.since)} and ${formatClockTime(gap.until)}`
}
