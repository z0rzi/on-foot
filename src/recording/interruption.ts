import { formatClockTime } from '../activities/format'

// The span a dead process left without positions: from the moment the session was last known
// recording (`lastKnownRecordingAt`) to the relaunch. It says what is missing, not when the process died.
export interface InterruptionGap {
  since: number
  until: number
}

export function interruptionMessage(gap: InterruptionGap): string {
  return `No position between ${formatClockTime(gap.since)} and ${formatClockTime(gap.until)}`
}
