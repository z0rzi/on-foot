import type { CaptureFault, RecordingPhase } from './recordingStore'

export type RecordingHealth =
  | { kind: 'idle' }
  | { kind: 'paused' }
  | { kind: 'location-off' }
  | { kind: 'not-capturing'; fault: CaptureFault }
  | { kind: 'recording' }

// What the recording sheet may claim, from facts the app observed rather than inferred from GPS
// silence. A missing provider names the cause of not capturing, so it outranks a capture fault.
export function recordingHealthFor(input: {
  phase: RecordingPhase
  locationAvailable: boolean | null
  captureFault: CaptureFault | null
}): RecordingHealth {
  if (input.phase === 'idle') return { kind: 'idle' }
  if (input.phase === 'paused') return { kind: 'paused' }
  if (input.locationAvailable === false) return { kind: 'location-off' }
  if (input.captureFault) return { kind: 'not-capturing', fault: input.captureFault }
  return { kind: 'recording' }
}

export function recordingStatusText(health: RecordingHealth): { title: string; detail: string | null } {
  switch (health.kind) {
    case 'idle':
    case 'recording':
      return { title: '● Recording', detail: null }
    case 'paused':
      return { title: '⏸ Paused', detail: null }
    case 'location-off':
      return { title: 'Location is off', detail: "Recording continues when it's back on." }
    case 'not-capturing':
      return {
        title: 'Not recording location',
        detail: health.fault === 'permission-missing' ? 'Allow location access for On Foot in Settings.' : null,
      }
  }
}
