import type { MapState } from '@rnmapbox/maps'
import { cameraStopFor, fitCameraFor, framingFromMapState } from '../camera'

const state: MapState = {
  properties: {
    center: [6.8652, 45.8326],
    bounds: { ne: [6.9, 45.9], sw: [6.8, 45.8] },
    zoom: 13.5,
    heading: 42,
    pitch: 30,
  },
  gestures: { isGestureActive: false },
}

describe('framingFromMapState', () => {
  test('carries centre [lng, lat], zoom, pitch and heading', () =>
    expect(framingFromMapState(state)).toEqual({
      center: [6.8652, 45.8326],
      zoom: 13.5,
      pitch: 30,
      heading: 42,
    }))

  // rnmapbox's Android map sends an empty payload while it has no camera state, despite the type.
  test('an empty payload is no framing', () =>
    expect(framingFromMapState({} as MapState)).toBeNull())
})

describe('cameraStopFor', () => {
  test('places the camera on the framing without animation', () =>
    expect(cameraStopFor({ center: [6.8652, 45.8326], zoom: 13.5, pitch: 30, heading: 42 })).toEqual({
      centerCoordinate: [6.8652, 45.8326],
      zoomLevel: 13.5,
      pitch: 30,
      heading: 42,
      animationDuration: 0,
    }))
})

// The zoom at which one dp of the map covers `metresPerDp` at `lat`, from the ground scale of a
// 512-dp Web Mercator world.
function zoomForScale(metresPerDp: number, lat: number): number {
  return Math.log2((40075016.686 * Math.cos((lat * Math.PI) / 180)) / (512 * metresPerDp))
}

// A box `eastMetres` wide and `northMetres` tall, its south-west corner at `[lng, lat]`, in the
// spherical metres the map is drawn in.
function box(lng: number, lat: number, eastMetres: number, northMetres: number) {
  const dLng = eastMetres / (111320 * Math.cos((lat * Math.PI) / 180))
  const dLat = northMetres / 111320
  return { sw: [lng, lat] as [number, number], ne: [lng + dLng, lat + dLat] as [number, number] }
}

// The phone the 2026-11-07 device look ran on: the Map view in dp, and the padding T-58 gives a
// shown activity (pill above, collapsed sheet with its graph below).
const phone = { width: 423.5, height: 941 }
const shownPadding: [number, number, number, number] = [120.5, 100, 162, 100]

describe('fitCameraFor', () => {
  // B2: a 2 km loop, 800 m by 565 m, was framed at about zoom 10.7, the whole city on screen.
  test('a 2 km loop fills the band the padding leaves, at walking scale', () => {
    const { ne, sw } = box(1.44345, 43.60445, 800, 565)
    const { zoom } = fitCameraFor({ ne, sw, size: phone, padding: shownPadding, heading: 0, maxZoom: 25 })
    expect(zoom).toBeCloseTo(zoomForScale(800 / (423.5 - 200), 43.6), 2)
  })

  // On a Mercator map the latitudes stretch going north, so the box's middle on screen is north of
  // its middle latitude: 0°-60° N centres at 35.26° N, not 30° N.
  test('centres the box as the map draws it', () => {
    const { center } = fitCameraFor({ ne: [20, 60], sw: [0, 0], size: phone, padding: shownPadding, heading: 0, maxZoom: 25 })
    expect(center[0]).toBeCloseTo(10, 6)
    expect(center[1]).toBeCloseTo(35.264, 2)
  })

  // Turned a quarter, a wide box stands tall on screen: its 800 m run down the view's height.
  test('frames the box as the heading turns it', () => {
    const { ne, sw } = box(1.44345, 43.60445, 800, 200)
    const { zoom } = fitCameraFor({ ne, sw, size: phone, padding: shownPadding, heading: 90, maxZoom: 25 })
    expect(zoom).toBeCloseTo(zoomForScale(800 / (941 - 120.5 - 162), 43.6), 2)
  })

  test('a box with no extent, or a tiny one, zooms no closer than the map allows', () => {
    const point = { ne: [1.44345, 43.60445] as [number, number], sw: [1.44345, 43.60445] as [number, number] }
    expect(fitCameraFor({ ...point, size: phone, padding: shownPadding, heading: 0, maxZoom: 25 }).zoom).toBe(25)
    const { ne, sw } = box(1.44345, 43.60445, 0.05, 0.05)
    expect(fitCameraFor({ ne, sw, size: phone, padding: shownPadding, heading: 0, maxZoom: 25 }).zoom).toBe(25)
  })

  // A view smaller than its padding (split screen, a tiny window) still gets a camera.
  test('padding wider than the view still gives a zoom', () => {
    const { ne, sw } = box(1.44345, 43.60445, 800, 565)
    const { zoom } = fitCameraFor({ ne, sw, size: { width: 150, height: 250 }, padding: shownPadding, heading: 0, maxZoom: 25 })
    expect(Number.isFinite(zoom)).toBe(true)
  })
})
