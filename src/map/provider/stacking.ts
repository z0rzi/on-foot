// The overview's line layers, bottom to top, all below the route tiers: the rest of the overview
// dimmed, the rest shown at full strength, then the selected item's family. The provider holds this
// order as it holds the route tiers' (D127). They are not route tiers: no route overlay draws there.
export const OVERVIEW_LINE_SLOTS = ['dimmed', 'shown', 'family'] as const

export type OverviewLineSlot = (typeof OVERVIEW_LINE_SLOTS)[number]

// The stacking tiers of the route overlays, bottom to top: the shown route (trail or activity),
// then the live recording track above it. Each overlay names its tier; the provider keeps the
// lines of an overlay within its tier, whatever order the overlays mount in, a style reload
// included. Its markers (arrows, endpoints) may draw above the lines of both tiers, as Mapbox
// draws them with terrain on (D102).
export const ROUTE_TIERS = ['route', 'liveTrack'] as const

export type RouteTier = (typeof ROUTE_TIERS)[number]

// The layers of one route overlay, bottom to top inside its tier: its lines, then its markers.
// The provider holds this order whatever order the layers mount in: a line source that remounts,
// connectors that appear after the first render, a style reload.
export const ROUTE_LAYERS = ['casing', 'line', 'connectors', 'arrows', 'endpoints'] as const

export type RouteLayer = (typeof ROUTE_LAYERS)[number]
