import { ROUTE_LAYERS, ROUTE_TIERS, type RouteLayer, type RouteTier } from '../../provider/routeTiers'

// One invisible anchor per slot, a slot being one kind of layer inside one tier. A route overlay
// layer is inserted just below its slot's anchor, so it lands between the slot below and its own.
export function anchorLayerIdForSlot(tier: RouteTier, layer: RouteLayer): string {
  return `tier-anchor-${tier}-${layer}`
}

// The anchor layers in mount order, which is their stacking order, bottom to top: tier by tier,
// each tier's slots in layer order.
export const SLOT_ANCHORS: readonly string[] = ROUTE_TIERS.flatMap((tier) =>
  ROUTE_LAYERS.map((layer) => anchorLayerIdForSlot(tier, layer)),
)
