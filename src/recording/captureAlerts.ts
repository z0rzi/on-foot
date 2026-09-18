import type { CaptureRefusal } from './recordingController'

export type CaptureAction = 'start' | 'resume'

// Starting and resuming are refused for the same reasons, so they explain the refusal in the same words.
export function captureRefusalAlert(refusal: CaptureRefusal, action: CaptureAction): { title: string; message: string } {
  if (refusal === 'permission-denied') {
    return {
      title: 'Location permission needed',
      message: 'To record your activity while the app is in the background, allow location access "All the time".',
    }
  }
  return { title: 'Location is off', message: `Turn on location to ${action} recording.` }
}
