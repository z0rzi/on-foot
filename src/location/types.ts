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
