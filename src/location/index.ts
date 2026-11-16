export type { BackgroundTrackingOptions, LocationFix, NotificationAccess } from './types'
export {
  defineBackgroundFixHandler,
  hasBackgroundAccess,
  hasForegroundAccess,
  isLocationAvailable,
  promptToEnableLocation,
  requestBackgroundAccess,
  requestForegroundAccess,
  requestTrackingNotificationAccess,
  startBackgroundTracking,
  stopBackgroundTracking,
  watchHeading,
} from './expoLocation'
