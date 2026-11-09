import { ROUTE_TIERS, type RouteTier } from '../../provider/routeTiers'

export function anchorLayerIdFor(tier: RouteTier): string {
  return `tier-anchor-${tier}`
}

// The anchor layers in mount order, which is their stacking order, bottom to top.
export const TIER_ANCHORS: readonly string[] = ROUTE_TIERS.map(anchorLayerIdFor)
