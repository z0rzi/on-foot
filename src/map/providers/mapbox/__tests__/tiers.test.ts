import { ROUTE_TIERS } from '../../../provider/routeTiers'
import { TIER_ANCHORS, anchorLayerIdFor } from '../tiers'

describe('route tiers', () => {
  test('the port stacks the shown route below the live track', () =>
    expect(ROUTE_TIERS).toEqual(['route', 'liveTrack']))

  test('each tier has its own anchor layer', () =>
    expect(new Set(ROUTE_TIERS.map(anchorLayerIdFor)).size).toBe(ROUTE_TIERS.length))

  test('the anchors mount bottom to top: the route anchor before the live track anchor', () =>
    expect(TIER_ANCHORS).toEqual([anchorLayerIdFor('route'), anchorLayerIdFor('liveTrack')]))
})
