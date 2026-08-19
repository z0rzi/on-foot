import { useEffect } from 'react'
import * as Location from 'expo-location'

/**
 * Requests foreground location permission on mount, mirroring the Kotlin
 * original's request-on-launch behaviour. Once granted, the Mapbox
 * LocationPuck (rendered by the map provider) starts showing the user's
 * position — no need to gate rendering on the result here.
 */
export function useLocationPermission() {
  useEffect(() => {
    Location.requestForegroundPermissionsAsync()
  }, [])
}
