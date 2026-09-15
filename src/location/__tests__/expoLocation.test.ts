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
import type { LocationObject } from 'expo-location'
import {
  fixesFromTaskData,
  isLocationAvailable,
  promptToEnableLocation,
  requestTrackingNotificationAccess,
  startBackgroundTracking,
  stopBackgroundTracking,
  toLocationFix,
} from '../expoLocation'
import type { BackgroundTrackingOptions } from '../types'

const options: BackgroundTrackingOptions = {
  minDistanceM: 10,
  batch: { intervalMs: 15000, distanceM: 50 },
  activity: 'fitness',
  notification: { title: 'On Foot', body: 'Recording your activity', color: '#123456' },
}

const location = (latitude: number, longitude: number, altitude: number | null, timestamp: number): LocationObject => ({
  coords: { latitude, longitude, altitude, accuracy: 5, altitudeAccuracy: null, heading: null, speed: null },
  timestamp,
})

beforeEach(() => {
  jest.clearAllMocks()
  mockPlatform = { OS: 'android', Version: 33 }
})

describe('toLocationFix', () => {
  it('maps a device location to a fix, rounding the timestamp', () => {
    expect(toLocationFix(location(1.5, -2.5, 120, 1234.7))).toEqual({ lat: 1.5, lng: -2.5, ele: 120, t: 1235 })
  })
  it('keeps a missing altitude as a null elevation', () => {
    expect(toLocationFix(location(0, 0, null, 5))).toEqual({ lat: 0, lng: 0, ele: null, t: 5 })
  })
})

describe('fixesFromTaskData', () => {
  it('maps the delivered locations', () => {
    expect(fixesFromTaskData({ locations: [location(1, 2, 3, 4)] })).toEqual([{ lat: 1, lng: 2, ele: 3, t: 4 }])
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
  it('stops the task when it is registered', async () => {
    jest.mocked(Location.hasStartedLocationUpdatesAsync).mockResolvedValue(true)
    await stopBackgroundTracking()
    expect(Location.stopLocationUpdatesAsync).toHaveBeenCalledWith('onfoot-location-recording')
  })
  it('does nothing when no task is registered', async () => {
    jest.mocked(Location.hasStartedLocationUpdatesAsync).mockResolvedValue(false)
    await stopBackgroundTracking()
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
