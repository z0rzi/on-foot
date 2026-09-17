import type { BackgroundTrackingOptions } from '../location'
import { lightColors } from '../theme/colors'

// Background capture tuning — the single source of truth. Batched delivery minimises process
// wakeups; the minimum distance caps redundant fixes.
export const RECORDING_OPTIONS: BackgroundTrackingOptions = {
  minDistanceM: 10,
  batch: { intervalMs: 15000, distanceM: 50 },
  activity: 'fitness',
  notification: {
    title: 'On Foot',
    body: 'Recording your activity',
    color: lightColors.controlAccent,
  },
}
