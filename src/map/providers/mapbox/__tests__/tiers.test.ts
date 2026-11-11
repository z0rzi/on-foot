import { ROUTE_LAYERS, ROUTE_TIERS } from '../../../provider/routeTiers'
import { SLOT_ANCHORS, anchorLayerIdForSlot } from '../tiers'

describe('route tiers', () => {
  test('the port stacks the shown route below the live track', () =>
    expect(ROUTE_TIERS).toEqual(['route', 'liveTrack']))

  test('the port stacks the layers of one overlay bottom to top: its lines, then its markers', () =>
    expect(ROUTE_LAYERS).toEqual(['casing', 'line', 'connectors', 'arrows', 'endpoints']))

  test('each layer of each tier has its own anchor layer', () => {
    const anchors = ROUTE_TIERS.flatMap((tier) => ROUTE_LAYERS.map((layer) => anchorLayerIdForSlot(tier, layer)))
    expect(new Set(anchors).size).toBe(ROUTE_TIERS.length * ROUTE_LAYERS.length)
  })

  test('the anchors mount bottom to top: every route slot in layer order, then every live track slot', () =>
    expect(SLOT_ANCHORS).toEqual([
      anchorLayerIdForSlot('route', 'casing'),
      anchorLayerIdForSlot('route', 'line'),
      anchorLayerIdForSlot('route', 'connectors'),
      anchorLayerIdForSlot('route', 'arrows'),
      anchorLayerIdForSlot('route', 'endpoints'),
      anchorLayerIdForSlot('liveTrack', 'casing'),
      anchorLayerIdForSlot('liveTrack', 'line'),
      anchorLayerIdForSlot('liveTrack', 'connectors'),
      anchorLayerIdForSlot('liveTrack', 'arrows'),
      anchorLayerIdForSlot('liveTrack', 'endpoints'),
    ]))
})
