import * as Location from 'expo-location'
import * as TaskManager from 'expo-task-manager'
import { PermissionsAndroid, Platform } from 'react-native'
import type { BackgroundTrackingOptions, LocationFix, NotificationAccess } from './types'

const RECORDING_TASK = 'onfoot-location-recording'

const ACTIVITY_TYPES: Record<BackgroundTrackingOptions['activity'], Location.ActivityType> = {
  fitness: Location.ActivityType.Fitness,
}

export function toLocationFix(location: Location.LocationObject): LocationFix {
  return {
    lat: location.coords.latitude,
    lng: location.coords.longitude,
    ele: location.coords.altitude,
    t: Math.round(location.timestamp),
  }
}

export function fixesFromTaskData(data: unknown): LocationFix[] {
  const locations = (data as { locations?: Location.LocationObject[] } | null)?.locations
  return locations ? locations.map(toLocationFix) : []
}

function toTaskOptions(options: BackgroundTrackingOptions): Location.LocationTaskOptions {
  return {
    accuracy: Location.Accuracy.High,
    distanceInterval: options.minDistanceM,
    deferredUpdatesInterval: options.batch.intervalMs,
    deferredUpdatesDistance: options.batch.distanceM,
    pausesUpdatesAutomatically: false,
    activityType: ACTIVITY_TYPES[options.activity],
    foregroundService: {
      notificationTitle: options.notification.title,
      notificationBody: options.notification.body,
      notificationColor: options.notification.color,
    },
  }
}

export function defineBackgroundFixHandler(handler: (fixes: LocationFix[]) => Promise<void>): void {
  TaskManager.defineTask(RECORDING_TASK, async ({ data, error }) => {
    if (error) return
    const fixes = fixesFromTaskData(data)
    if (fixes.length > 0) await handler(fixes)
  })
}

// Registers the task, or — when it is already registered — restarts its request in place. It does
// not promise fixes: with no location provider available it makes no request, and on a registered
// task it first stops the live one. It rejects when the app is not in the foreground. A request that
// is live survives the device's location being switched off and on.
export async function startBackgroundTracking(options: BackgroundTrackingOptions): Promise<void> {
  await Location.startLocationUpdatesAsync(RECORDING_TASK, toTaskOptions(options))
}

export async function stopBackgroundTracking(): Promise<void> {
  if (await Location.hasStartedLocationUpdatesAsync(RECORDING_TASK)) {
    await Location.stopLocationUpdatesAsync(RECORDING_TASK)
  }
}

// GPS or network enabled — the exact test the native start applies before issuing a request.
export function isLocationAvailable(): Promise<boolean> {
  return Location.hasServicesEnabledAsync()
}

// Shows the system "turn on location" dialog. Its answer arrives only through the activity result,
// and nothing settles it if that never comes, so callers must not hold other work behind it.
export async function promptToEnableLocation(): Promise<boolean> {
  try {
    await Location.enableNetworkProviderAsync()
    return true
  } catch {
    return false
  }
}

// A start with a foreground service needs only the foreground grant.
export async function hasForegroundAccess(): Promise<boolean> {
  return (await Location.getForegroundPermissionsAsync()).granted
}

export async function requestForegroundAccess(): Promise<boolean> {
  return (await Location.requestForegroundPermissionsAsync()).granted
}

export async function requestBackgroundAccess(): Promise<boolean> {
  return (await Location.requestBackgroundPermissionsAsync()).granted
}

// Notifications need a runtime grant only from Android 13. React Native reports a refusal without a
// rationale as "never ask again", so the answer must never gate recording.
export async function requestTrackingNotificationAccess(): Promise<NotificationAccess> {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 33) return 'not-applicable'
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS)
  return result === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : 'denied'
}
