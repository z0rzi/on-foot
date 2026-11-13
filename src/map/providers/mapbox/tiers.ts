import {
  OVERVIEW_LINE_SLOTS, ROUTE_LAYERS, ROUTE_TIERS, type OverviewLineSlot, type RouteLayer, type RouteTier,
} from '../../provider/stacking'

// One invisible anchor per slot, a slot being one kind of layer inside one tier, or one of the
// overview's line layers. A layer is inserted just below its slot's anchor, so it lands between
// the slot below and its own.
export function anchorLayerIdForSlot(tier: RouteTier, layer: RouteLayer): string {
  return `tier-anchor-${tier}-${layer}`
}

export function anchorLayerIdForOverviewSlot(slot: OverviewLineSlot): string {
  return `tier-anchor-overview-${slot}`
}

// The overview's pins and clusters, above every line, the routes' included: markers over the lines,
// as Mapbox draws them with terrain on (D102), and placed before a route's arrows, so a tag never
// gives way to an arrow. Their layers always mount together with their source, so they stack in
// child order below this one anchor.
export const OVERVIEW_PINS_ANCHOR = 'tier-anchor-overview-pins'

// The anchor layers in mount order, which is their stacking order, bottom to top: the overview's
// line slots, then tier by tier, each tier's slots in layer order, then the pins.
export const SLOT_ANCHORS: readonly string[] = [
  ...OVERVIEW_LINE_SLOTS.map(anchorLayerIdForOverviewSlot),
  ...ROUTE_TIERS.flatMap((tier) => ROUTE_LAYERS.map((layer) => anchorLayerIdForSlot(tier, layer))),
  OVERVIEW_PINS_ANCHOR,
]
