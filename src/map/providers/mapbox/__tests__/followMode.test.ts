import Mapbox from '@rnmapbox/maps'
import { trackingModeFor } from '../followMode'

describe('trackingModeFor', () => {
  test('position -> Follow (north-up)', () =>
    expect(trackingModeFor('position')).toBe(Mapbox.UserTrackingMode.Follow))
  test('positionAndBearing -> FollowWithHeading', () =>
    expect(trackingModeFor('positionAndBearing')).toBe(Mapbox.UserTrackingMode.FollowWithHeading))
})
