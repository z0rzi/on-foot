import { toTrackPoint } from '../track'

describe('toTrackPoint', () => {
  it('maps a device location to a track point', () => {
    expect(toTrackPoint({
      coords: { latitude: 1.5, longitude: -2.5, altitude: 120 }, timestamp: 1234.7,
    })).toEqual({ lat: 1.5, lng: -2.5, ele: 120, t: 1235 })
  })
  it('keeps a null altitude as null ele', () => {
    expect(toTrackPoint({
      coords: { latitude: 0, longitude: 0, altitude: null }, timestamp: 5,
    })).toEqual({ lat: 0, lng: 0, ele: null, t: 5 })
  })
})
