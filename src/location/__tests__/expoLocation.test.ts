let mockPlatform = { OS: 'android', Version: 33 }
const mockPermissionRequest = jest.fn()

jest.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  ActivityType: { Fitness: 3 },
  startLocationUpdatesAsync: jest.fn(),
  stopLocationUpdatesAsync: jest.fn(),
  hasStartedLocationUpdatesAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(),
  enableNetworkProviderAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  requestBackgroundPermissionsAsync: jest.fn(),
  watchHeadingAsync: jest.fn(),
}))
jest.mock('expo-task-manager', () => ({ defineTask: jest.fn() }))
jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native')
  const descriptors = Object.getOwnPropertyDescriptors(actual)
  descriptors.Platform = { enumerable: true, configurable: true, get: () => mockPlatform }
  descriptors.PermissionsAndroid = {
    enumerable: true,
    configurable: true,
    value: {
      PERMISSIONS: { POST_NOTIFICATIONS: 'android.permission.POST_NOTIFICATIONS' },
      RESULTS: { GRANTED: 'granted' },
      request: (permission: string) => mockPermissionRequest(permission),
    },
  }
  return Object.create(Object.getPrototypeOf(actual), descriptors)
})

import * as Location from 'expo-location'
import * as TaskManager from 'expo-task-manager'
import type { LocationObject } from 'expo-location'
import {
  defineBackgroundFixHandler,
  fixesFromTaskData,
  isLocationAvailable,
  promptToEnableLocation,
  requestTrackingNotificationAccess,
  startBackgroundTracking,
  stopBackgroundTracking,
  toLocationFix,
  watchHeading,
} from '../expoLocation'
import type { BackgroundTrackingOptions } from '../types'

const options: BackgroundTrackingOptions = {
  minDistanceM: 10,
  batch: { intervalMs: 15000, distanceM: 50 },
  activity: 'fitness',
  notification: { title: 'On Foot', body: 'Recording your activity', color: '#123456' },
}

const location = (
  latitude: number,
  longitude: number,
  altitude: number | null,
  timestamp: number,
  accuracy: number | null = 5,
): LocationObject => ({
  coords: { latitude, longitude, altitude, accuracy, altitudeAccuracy: null, heading: null, speed: null },
  timestamp,
})

beforeEach(() => {
  jest.clearAllMocks()
  mockPlatform = { OS: 'android', Version: 33 }
})

describe('toLocationFix', () => {
  it('maps a device location to a fix, rounding the timestamp', () => {
    expect(toLocationFix(location(1.5, -2.5, 120, 1234.7))).toEqual({
      lat: 1.5, lng: -2.5, ele: 120, t: 1235, accuracy: 5,
    })
  })
  it('keeps a missing altitude as a null elevation', () => {
    expect(toLocationFix(location(0, 0, null, 5))).toEqual({ lat: 0, lng: 0, ele: null, t: 5, accuracy: 5 })
  })
  it('maps a positive accuracy radius across unchanged', () => {
    expect(toLocationFix(location(0, 0, null, 5, 12.5)).accuracy).toBe(12.5)
  })
  it('keeps a missing accuracy as null', () => {
    expect(toLocationFix(location(0, 0, null, 5, null)).accuracy).toBeNull()
  })
  it('reads a zero accuracy, as Android reports a missing one, as unknown', () => {
    expect(toLocationFix(location(0, 0, null, 5, 0)).accuracy).toBeNull()
  })
  it('reads a negative accuracy, as iOS reports an invalid one, as unknown', () => {
    expect(toLocationFix(location(0, 0, null, 5, -1)).accuracy).toBeNull()
  })
})

describe('fixesFromTaskData', () => {
  it('maps the delivered locations', () => {
    expect(fixesFromTaskData({ locations: [location(1, 2, 3, 4)] })).toEqual([
      { lat: 1, lng: 2, ele: 3, t: 4, accuracy: 5 },
    ])
  })
  it('yields nothing for an empty or malformed delivery', () => {
    expect(fixesFromTaskData(null)).toEqual([])
    expect(fixesFromTaskData({})).toEqual([])
  })
})

describe('startBackgroundTracking', () => {
  it('starts the recording task with high accuracy and the given tuning', async () => {
    jest.mocked(Location.startLocationUpdatesAsync).mockResolvedValue(undefined)
    await startBackgroundTracking(options)
    expect(Location.startLocationUpdatesAsync).toHaveBeenCalledWith('onfoot-location-recording', {
      accuracy: 4,
      distanceInterval: 10,
      deferredUpdatesInterval: 15000,
      deferredUpdatesDistance: 50,
      pausesUpdatesAutomatically: false,
      activityType: 3,
      foregroundService: {
        notificationTitle: 'On Foot',
        notificationBody: 'Recording your activity',
        notificationColor: '#123456',
      },
    })
  })
  it('passes a rejection through unchanged', async () => {
    const refused = Object.assign(new Error('refused'), { code: 'ERR_FOREGROUND_SERVICE_START_NOT_ALLOWED' })
    jest.mocked(Location.startLocationUpdatesAsync).mockRejectedValue(refused)
    await expect(startBackgroundTracking(options)).rejects.toBe(refused)
  })
})

describe('stopBackgroundTracking', () => {
  it('stops the task when it is registered, and says it stopped one', async () => {
    jest.mocked(Location.hasStartedLocationUpdatesAsync).mockResolvedValue(true)
    await expect(stopBackgroundTracking()).resolves.toBe(true)
    expect(Location.stopLocationUpdatesAsync).toHaveBeenCalledWith('onfoot-location-recording')
  })
  it('does nothing when no task is registered, and says none was running', async () => {
    jest.mocked(Location.hasStartedLocationUpdatesAsync).mockResolvedValue(false)
    await expect(stopBackgroundTracking()).resolves.toBe(false)
    expect(Location.stopLocationUpdatesAsync).not.toHaveBeenCalled()
  })
})

describe('isLocationAvailable', () => {
  it('uses the same provider test as the native start', async () => {
    jest.mocked(Location.hasServicesEnabledAsync).mockResolvedValue(false)
    await expect(isLocationAvailable()).resolves.toBe(false)
  })
})

describe('promptToEnableLocation', () => {
  it('is true when the prompt resolves', async () => {
    jest.mocked(Location.enableNetworkProviderAsync).mockResolvedValue(undefined)
    await expect(promptToEnableLocation()).resolves.toBe(true)
  })
  it('is false when the prompt is declined or cannot be shown', async () => {
    jest.mocked(Location.enableNetworkProviderAsync).mockRejectedValue(new Error('declined'))
    await expect(promptToEnableLocation()).resolves.toBe(false)
  })
})

describe('requestTrackingNotificationAccess', () => {
  it('does not ask below Android 13', async () => {
    mockPlatform = { OS: 'android', Version: 32 }
    await expect(requestTrackingNotificationAccess()).resolves.toBe('not-applicable')
    expect(mockPermissionRequest).not.toHaveBeenCalled()
  })
  it('reports a grant', async () => {
    mockPermissionRequest.mockResolvedValue('granted')
    await expect(requestTrackingNotificationAccess()).resolves.toBe('granted')
    expect(mockPermissionRequest).toHaveBeenCalledWith('android.permission.POST_NOTIFICATIONS')
  })
  it('reports any other answer as denied', async () => {
    mockPermissionRequest.mockResolvedValue('never_ask_again')
    await expect(requestTrackingNotificationAccess()).resolves.toBe('denied')
  })
})

describe('defineBackgroundFixHandler', () => {
  type Executor = (body: { data: unknown; error: { message?: string | null } | null }) => Promise<void>
  const handler = jest.fn()
  const onDeliveryFault = jest.fn()
  const defined = (): Executor => {
    handler.mockResolvedValue(undefined)
    defineBackgroundFixHandler(handler, onDeliveryFault)
    return jest.mocked(TaskManager.defineTask).mock.calls[0][1] as unknown as Executor
  }

  it('hands the fixes of a delivery to the handler and reports no fault', async () => {
    await defined()({ data: { locations: [location(1, 2, 3, 4)] }, error: null })
    expect(handler).toHaveBeenCalledWith([{ lat: 1, lng: 2, ele: 3, t: 4, accuracy: 5 }])
    expect(onDeliveryFault).not.toHaveBeenCalled()
  })
  it('reports a delivery that carried an error, with its message, and hands over nothing', async () => {
    await defined()({ data: {}, error: { message: 'task failed' } })
    expect(onDeliveryFault).toHaveBeenCalledWith('error', 'task failed')
    expect(handler).not.toHaveBeenCalled()
  })
  it('reports an error with no message', async () => {
    await defined()({ data: {}, error: { message: null } })
    expect(onDeliveryFault).toHaveBeenCalledWith('error', undefined)
  })
  it('reports a delivery with no location as empty', async () => {
    const execute = defined()
    await execute({ data: {}, error: null })
    await execute({ data: { locations: [] }, error: null })
    expect(onDeliveryFault.mock.calls).toEqual([['empty'], ['empty']])
    expect(handler).not.toHaveBeenCalled()
  })
})

describe('watchHeading', () => {
  it('hands each reading over as a magnetic heading and its calibration grade', async () => {
    ;(Location.watchHeadingAsync as jest.Mock).mockResolvedValue({ remove: jest.fn() })
    const listener = jest.fn()
    await watchHeading(listener)
    const onHeading = (Location.watchHeadingAsync as jest.Mock).mock.calls[0][0]
    onHeading({ trueHeading: -1, magHeading: 271.5, accuracy: 2 })
    expect(listener).toHaveBeenCalledWith({ degrees: 271.5, accuracy: 2 })
  })

  it('resolves to a stop that removes the subscription', async () => {
    const remove = jest.fn()
    ;(Location.watchHeadingAsync as jest.Mock).mockResolvedValue({ remove })
    const stop = await watchHeading(jest.fn())
    expect(remove).not.toHaveBeenCalled()
    stop()
    expect(remove).toHaveBeenCalledTimes(1)
  })

  it('rejects when the watch cannot start', async () => {
    ;(Location.watchHeadingAsync as jest.Mock).mockRejectedValue(new Error('no sensor'))
    await expect(watchHeading(jest.fn())).rejects.toThrow('no sensor')
  })
})
