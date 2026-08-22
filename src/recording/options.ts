import * as Location from 'expo-location'
import { lightColors } from '../theme/colors'

// Background capture tuning — the single source of truth. Batched delivery
// (deferredUpdates*) minimises process wakeups; distanceInterval caps redundant fixes.
export const RECORDING_OPTIONS: Location.LocationTaskOptions = {
  accuracy: Location.Accuracy.High,
  distanceInterval: 10,
  deferredUpdatesInterval: 15000,
  deferredUpdatesDistance: 50,
  pausesUpdatesAutomatically: false,
  activityType: Location.ActivityType.Fitness,
  foregroundService: {
    notificationTitle: 'On Foot',
    notificationBody: 'Recording your activity',
    notificationColor: lightColors.controlAccent,
  },
}
