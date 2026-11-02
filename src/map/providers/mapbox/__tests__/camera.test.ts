import type { MapState } from '@rnmapbox/maps'
import { cameraStopFor, framingFromMapState } from '../camera'

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
