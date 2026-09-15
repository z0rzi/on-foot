export type { BackgroundTrackingOptions, LocationFix, NotificationAccess } from './types'
export {
  defineBackgroundFixHandler,
  hasForegroundAccess,
  isLocationAvailable,
  promptToEnableLocation,
  requestBackgroundAccess,
  requestForegroundAccess,
  requestTrackingNotificationAccess,
  startBackgroundTracking,
  stopBackgroundTracking,
} from './expoLocation'
