import * as Location from 'expo-location'
import * as TaskManager from 'expo-task-manager'
import { PermissionsAndroid, Platform } from 'react-native'
import type {
  BackgroundTrackingOptions,
  DeliveryFault,
  HeadingReading,
  LocationFix,
  NotificationAccess,
} from './types'

const RECORDING_TASK = 'onfoot-location-recording'

const ACTIVITY_TYPES: Record<BackgroundTrackingOptions['activity'], Location.ActivityType> = {
  fitness: Location.ActivityType.Fitness,
}

// Android reports a missing accuracy as 0 and iOS an invalid one as negative.
function knownAccuracy(accuracy: number | null | undefined): number | null {
  return accuracy != null && accuracy > 0 ? accuracy : null
}

export function toLocationFix(location: Location.LocationObject): LocationFix {
  return {
    lat: location.coords.latitude,
    lng: location.coords.longitude,
    ele: location.coords.altitude,
    t: Math.round(location.timestamp),
    accuracy: knownAccuracy(location.coords.accuracy),
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

// A delivery that carries no fix never reaches the handler; onDeliveryFault is told instead, with
// the error's message when there is one. Android's error body holds a message and no code.
export function defineBackgroundFixHandler(
  handler: (fixes: LocationFix[]) => Promise<void>,
  onDeliveryFault: (fault: DeliveryFault, error?: string) => void,
): void {
  TaskManager.defineTask(RECORDING_TASK, async ({ data, error }) => {
    if (error) {
      onDeliveryFault('error', error.message ?? undefined)
      return
    }
    const fixes = fixesFromTaskData(data)
    if (fixes.length === 0) {
      onDeliveryFault('empty')
      return
    }
    await handler(fixes)
  })
}

// Registers the task, or — when it is already registered — restarts its request in place. It does
// not promise fixes: with no location provider available it makes no request, and on a registered
// task it first stops the live one. It rejects when the app is not in the foreground. A request that
// is live survives the device's location being switched off and on.
export async function startBackgroundTracking(options: BackgroundTrackingOptions): Promise<void> {
  await Location.startLocationUpdatesAsync(RECORDING_TASK, toTaskOptions(options))
}

// Resolves to whether a running stream was stopped; with none running it does nothing.
export async function stopBackgroundTracking(): Promise<boolean> {
  if (!(await Location.hasStartedLocationUpdatesAsync(RECORDING_TASK))) return false
  await Location.stopLocationUpdatesAsync(RECORDING_TASK)
  return true
}

// Resolves to the function that ends the watch. Android sends a reading only when the compass has
// turned about 2° since the last one, so a phone held steady is silent; it stops the watch while
// the app is in the background, holds one watch at a time, and without the location grant or a
// magnetometer resolves all the same and sends nothing.
export async function watchHeading(listener: (reading: HeadingReading) => void): Promise<() => void> {
  const subscription = await Location.watchHeadingAsync((heading) =>
    listener({ degrees: heading.magHeading, accuracy: heading.accuracy }),
  )
  return () => subscription.remove()
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
