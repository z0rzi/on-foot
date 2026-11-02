import type { CameraStop, MapState } from '@rnmapbox/maps'
import type { CameraFraming } from '../../provider/types'

// rnmapbox types `properties` as always present, but its Android map sends an empty payload while
// it has no camera state yet; that carries no framing.
export function framingFromMapState(state: MapState): CameraFraming | null {
  if (!state?.properties) return null
  const { center, zoom, pitch, heading } = state.properties
  return { center: [center[0], center[1]], zoom, pitch, heading }
}

export function cameraStopFor({ center, zoom, pitch, heading }: CameraFraming): CameraStop {
  return { centerCoordinate: center, zoomLevel: zoom, pitch, heading, animationDuration: 0 }
}
