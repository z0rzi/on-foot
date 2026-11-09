import type { RecordingPhase } from './recordingPhase'
import type { CaptureFault, StreamStatus } from './recordingStore'

export type RecordingHealth =
  | { kind: 'idle' }
  | { kind: 'paused' }
  | { kind: 'location-off' }
  | { kind: 'not-capturing'; fault: CaptureFault }
  | { kind: 'recording' }

// What the recording's status may claim, from facts the app observed rather than inferred from GPS
// silence. A missing provider names the cause of not capturing, so it outranks a capture fault.
export function recordingHealthFor(input: {
  phase: RecordingPhase
  locationAvailable: boolean | null
  stream: StreamStatus
}): RecordingHealth {
  if (input.phase === 'idle') return { kind: 'idle' }
  if (input.phase === 'paused') return { kind: 'paused' }
  if (input.locationAvailable === false) return { kind: 'location-off' }
  if (input.stream.kind === 'faulted') return { kind: 'not-capturing', fault: input.stream.fault }
  return { kind: 'recording' }
}

export interface RecordingWarning {
  text: string
  // Capture stopped while the session records, so asking for it again can bring it back.
  retry: boolean
}

// What is wrong with capture while recording, as one line; null when there is nothing to say.
export function recordingWarning(health: RecordingHealth): RecordingWarning | null {
  switch (health.kind) {
    case 'idle':
    case 'paused':
    case 'recording':
      return null
    case 'location-off':
      return { text: "Location is off · Recording continues when it's back on.", retry: false }
    case 'not-capturing':
      return {
        text:
          health.fault === 'permission-missing'
            ? 'Not recording location · Allow location access for On Foot in Settings.'
            : 'Not recording location',
        retry: true,
      }
  }
}
