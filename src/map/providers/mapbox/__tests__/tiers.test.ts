import { OVERVIEW_LINE_SLOTS, ROUTE_LAYERS, ROUTE_TIERS } from '../../../provider/stacking'
import { OVERVIEW_PINS_ANCHOR, SLOT_ANCHORS, anchorLayerIdForOverviewSlot, anchorLayerIdForSlot } from '../tiers'

describe('route tiers', () => {
  test('the port stacks the shown route below the live track', () =>
    expect(ROUTE_TIERS).toEqual(['route', 'liveTrack']))

  test('the port stacks the layers of one overlay bottom to top: its lines, then its markers', () =>
    expect(ROUTE_LAYERS).toEqual(['casing', 'line', 'connectors', 'arrows', 'endpoints']))

  test('the port stacks the overview lines bottom to top: the dimmed rest, the shown rest, the family', () =>
    expect(OVERVIEW_LINE_SLOTS).toEqual(['dimmed', 'shown', 'family']))

  test('each layer of each tier, each overview slot and the pins have their own anchor layer', () => {
    const anchors = [
      ...OVERVIEW_LINE_SLOTS.map(anchorLayerIdForOverviewSlot),
      ...ROUTE_TIERS.flatMap((tier) => ROUTE_LAYERS.map((layer) => anchorLayerIdForSlot(tier, layer))),
      OVERVIEW_PINS_ANCHOR,
    ]
    expect(new Set(anchors).size).toBe(OVERVIEW_LINE_SLOTS.length + ROUTE_TIERS.length * ROUTE_LAYERS.length + 1)
  })

  test('the anchors mount bottom to top: the overview slots, every route slot in layer order, every live track slot, then the pins', () =>
    expect(SLOT_ANCHORS).toEqual([
      anchorLayerIdForOverviewSlot('dimmed'),
      anchorLayerIdForOverviewSlot('shown'),
      anchorLayerIdForOverviewSlot('family'),
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
      OVERVIEW_PINS_ANCHOR,
    ]))
})
