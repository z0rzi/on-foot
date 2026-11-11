export interface LocationFix {
  lat: number
  lng: number
  ele: number | null
  t: number
  // A positive horizontal radius in metres, or null when the provider gave none.
  accuracy: number | null
}

export interface BackgroundTrackingOptions {
  minDistanceM: number
  batch: { intervalMs: number; distanceM: number }
  activity: 'fitness'
  notification: { title: string; body: string; color: string }
}

export type NotificationAccess = 'granted' | 'denied' | 'not-applicable'

// The compass: degrees clockwise from magnetic north in [0, 360), and the platform's calibration
// grade from 0 (uncalibrated) to 3 (high).
export interface HeadingReading {
  degrees: number
  accuracy: number
}

// A delivery of the background task that carried no fix: the task manager reported an error, or
// the body held no location.
export type DeliveryFault = 'error' | 'empty'
