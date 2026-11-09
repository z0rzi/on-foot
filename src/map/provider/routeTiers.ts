// The stacking tiers of the route overlays, bottom to top: the shown route (trail or activity),
// then the live recording track above it. Each overlay names its tier; the provider keeps every
// layer of an overlay within its tier, whatever order the overlays mount in, a style reload
// included.
export const ROUTE_TIERS = ['route', 'liveTrack'] as const

export type RouteTier = (typeof ROUTE_TIERS)[number]
