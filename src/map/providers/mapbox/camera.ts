import type { CameraPadding, CameraStop, MapState } from '@rnmapbox/maps'
import type { CameraFraming, EdgePadding } from '../../provider/types'
import { WORLD_DP_AT_ZOOM_0 } from '../../provider/zoom'

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

export function cameraPaddingFor([paddingTop, paddingRight, paddingBottom, paddingLeft]: EdgePadding): CameraPadding {
  return { paddingTop, paddingRight, paddingBottom, paddingLeft }
}

// Web Mercator, the world as the unit square: x east from the antimeridian, y south from the top.
function mercatorX(lng: number): number {
  return (lng + 180) / 360
}

function mercatorY(lat: number): number {
  const phi = (lat * Math.PI) / 180
  return (1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2
}

function latitudeOf(y: number): number {
  return (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI
}

export interface ViewSize {
  width: number
  height: number
}

// The camera that frames a box: centred on it, at the closest zoom where the box, turned to the
// heading, fits the view less the padding. A bounds camera stop cannot do it: Mapbox insets the
// box within the camera's current padding on top of the stop's, and following leaves its padding
// on the camera, so the box would get the room twice over. Framed top-down: every fit runs flat
// (the store sets the minimum pitch with each fit).
export function fitCameraFor({
  ne,
  sw,
  size,
  padding: [top, right, bottom, left],
  heading,
  maxZoom,
}: {
  ne: [number, number]
  sw: [number, number]
  size: ViewSize
  padding: EdgePadding
  heading: number
  maxZoom: number
}): { center: [number, number]; zoom: number } {
  const north = mercatorY(ne[1])
  const south = mercatorY(sw[1])
  const width = mercatorX(ne[0]) - mercatorX(sw[0])
  const height = south - north
  const turn = (heading * Math.PI) / 180
  const cos = Math.abs(Math.cos(turn))
  const sin = Math.abs(Math.sin(turn))
  // rnmapbox shrinks a padding that outgrows the view to leave it a pixel; one dp does the same here.
  const roomX = Math.max(size.width - left - right, 1)
  const roomY = Math.max(size.height - top - bottom, 1)
  const scale = Math.min(
    roomX / ((width * cos + height * sin) * WORLD_DP_AT_ZOOM_0),
    roomY / ((width * sin + height * cos) * WORLD_DP_AT_ZOOM_0),
  )
  return { center: [(ne[0] + sw[0]) / 2, latitudeOf((north + south) / 2)], zoom: Math.min(Math.log2(scale), maxZoom) }
}
