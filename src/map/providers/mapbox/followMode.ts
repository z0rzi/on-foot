import Mapbox from '@rnmapbox/maps'
import type { FollowUserMode } from '../../provider/types'

const TRACKING_MODE: Record<FollowUserMode, Mapbox.UserTrackingMode> = {
  position: Mapbox.UserTrackingMode.Follow,
  positionAndBearing: Mapbox.UserTrackingMode.FollowWithHeading,
}

export function trackingModeFor(mode: FollowUserMode): Mapbox.UserTrackingMode {
  return TRACKING_MODE[mode]
}
