import React from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import type { RouteTier } from './stacking'

// How light a layer's tiles are, as seen by what is drawn straight on them (the status bar's icons).
export type MapTone = 'light' | 'dark'

export interface StyleDescriptor {
  id: string
  label: string
  url: string
  preview: number
  tone: MapTone
  // Semantic marker: this style is the provider's satellite/aerial-imagery layer. Declared on
  // the port so provider-agnostic code (the store's quick-switch logic) can identify it without
  // hardcoding a provider-specific style id. A future provider marks its own imagery style.
  satellite?: boolean
  // The font stack the layer's own labels use. The map fetches glyphs per stack, and offline only
  // the layer's own stacks are there; a missing one blanks the whole source its text is in. So
  // text the app draws on the map uses this stack (D133).
  labelFont: readonly string[]
}

export interface MapCapabilities {
  id: string
  supportsTerrain: boolean
  styles: StyleDescriptor[]
  // The camera's zoom range, enforced by the provider's camera.
  minZoom: number
  maxZoom: number
}

// Where the camera looks: centre as [lng, lat], zoom, pitch and heading in degrees.
export interface CameraFraming {
  center: [number, number]
  zoom: number
  pitch: number
  heading: number
}

// How the camera follows the user: on position alone (north-up), or on position and the device
// heading. Each provider translates it to its own tracking mode.
export type FollowUserMode = 'position' | 'positionAndBearing'

// Insets in points, [top, right, bottom, left].
export type EdgePadding = [number, number, number, number]

export interface CameraProps {
  pitch?: number
  followUserLocation?: boolean
  followUserMode?: FollowUserMode
  followZoomLevel?: number
  followPitch?: number
  // Where the followed puck sits: centred in the map minus these insets.
  followPadding?: EdgePadding
  animationDuration?: number
  // The starting framing, read once at mount and applied without animation before the first
  // rendered frame. Later changes are ignored, so it can never move the camera.
  initialCamera?: CameraFraming
  // Fires when the map's user-tracking state changes. `following` is false when a manual gesture
  // cancels follow, so the app can drop its follow mode. SDK-neutral (see adapter for mapping).
  onUserTrackingModeChange?: (following: boolean) => void
}

export interface ColouredLine {
  coordinates: [number, number][]
  color: string
}

export interface RouteOverlayProps {
  // Where the overlay stacks among the route overlays (see ROUTE_TIERS). One overlay per tier, so
  // the tier also tells the overlays apart on the map.
  tier: RouteTier
  // Track segments as a MultiLineString: each entry is one segment's [lng, lat] pairs, in order.
  lines: [number, number][][]
  // Dashed connectors bridging consecutive segment endpoints; carry no distance.
  connectors: [number, number][][]
  connectorDashArray: number[]
  color: string
  lineWidth: number
  // When set, per-slope coloured polylines drawn instead of the single-colour `lines` (each
  // carries its own colour; the adapter draws them with a data-driven line colour). Stays
  // provider- and slope-agnostic: shared code maps slope band → colour before it reaches here.
  colouredLines?: ColouredLine[]
  // An outline drawn under the line to lift it off the map. Optional, because a line whose single
  // colour already reads against the map does not need one.
  casing?: boolean
  // Directional arrows are optional: omit arrowImage to render a plain line (used for recorded
  // activity tracks, where arrows on noisy GPS look cluttered, and for the live track).
  arrowImage?: number
  arrowSpacing?: number
  arrowSize?: number
  // [start, end] as [lng, lat] drawn as dot markers, with their styling. One optional unit so the
  // feature cannot be half-configured.
  endpoints?: {
    points: [number, number][]
    radius: number
    strokeColor: string
    strokeWidth: number
  }
}

// What an overview line stands for, as the focus tells lines apart: a trail, an activity tied to no
// trail, or an activity linked to one of the trails.
export type OverviewClass = 'trail' | 'activity' | 'linkedActivity'

export interface OverviewItem {
  // Opaque to the provider: it tells the items apart and comes back with a press.
  key: string
  class: OverviewClass
  // The text of a GeoJSON MultiLineString geometry, [lng, lat] positions, placed in the map's data
  // as is.
  geometry: string
}

// Which lines of the overview are drawn, and how. Derived in shared code from the user's choices,
// the selection and the recording; the provider turns it into layer filters without knowing the
// rules behind it.
export interface OverviewLineFocus {
  // The classes drawn outside the family.
  shownClasses: readonly OverviewClass[]
  // Drawn at full strength above the rest, whatever their class, and never in the rest.
  familyKeys: readonly string[]
  // Not drawn at all, the family included: the item another overlay draws in full.
  leftOutKey: string | null
  // The lines outside the family drawn dimmed rather than at full strength.
  restDimmed: boolean
}

// What a pin's teardrop says: a trail, a trail completed at least once (shown with activities or
// not, D116), or an activity.
export type OverviewPinKind = 'trail' | 'completedTrail' | 'completedTrailWithActivities' | 'activity'

// The mark at an item's start: a teardrop with its tip on the start and a tag beside its head.
export interface OverviewPin {
  // The key of the item it stands for, as in `OverviewItem`.
  key: string
  // [lng, lat] of the item's start, where the tip is.
  position: [number, number]
  kind: OverviewPinKind
  // The tag's text, ready to draw.
  tag: string
  // Drawn at the dimmed rest's opacity.
  dimmed: boolean
  // Where tags collide, the lower rank is kept; the teardrops always stay.
  rank: number
}

// A cluster under a press: the keys of the pins it holds, and the zoom at which it splits into
// smaller clusters or pins, past `OverviewProps.cluster.cap` when they stay merged at every zoom.
export interface OverviewClusterHit {
  keys: readonly string[]
  splitZoom: number
}

// What of the overview lies under a press, as keys, each once. The provider reports what it hit and
// never picks among it: shared code decides what the press means (D126).
export interface OverviewPress {
  // [lng, lat] of the press.
  point: [number, number]
  // The map's zoom at the press (`WORLD_DP_AT_ZOOM_0`).
  zoom: number
  pins: readonly string[]
  lines: readonly string[]
  clusters: readonly OverviewClusterHit[]
}

export interface OverviewProps {
  // Every item with a line, whatever the focus: they change only when a trail or an activity is
  // saved, changed or deleted, and the provider may treat a change as costly.
  items: readonly OverviewItem[]
  focus: OverviewLineFocus
  trailColor: string
  activityColor: string
  lineWidth: number
  // The zoom range over which the lines fade in, from invisible at `from` to full at `to`. Below
  // `from` no line is laid out, so none can be pressed.
  lineZoom: { from: number; to: number }
  // The opacity of the dimmed rest, its lines at full zoom and its pins, between 0 and 1.
  dimmedOpacity: number
  // Every pin shown, changed by a selection, a toggle, a recording or a data change. Pins and
  // clusters draw above every line, the routes' included, and a cluster holds only these pins.
  pins: readonly OverviewPin[]
  // The teardrop's border and centre, the cluster's border and count.
  pinInkColor: string
  clusterColor: string
  // The tag's text.
  tagTextColor: string
  // The font stack of the shown layer's labels (`StyleDescriptor.labelFont`), for the tags and the
  // counts.
  pinFont: readonly string[]
  // Pins closer than `radius` dp merge into a cluster, up to zoom `cap`; past the cap a cluster stays
  // one at every zoom, so two pins never sit on one pixel.
  cluster: { cap: number; radius: number }
  // How far from the finger, in dp, a press still finds a pin or a line: half the side of a square
  // around it.
  pressTolerance: number
  // Fires once per press on the map, with what of the overview it hit, possibly nothing. A press the
  // provider cannot read, as during a style reload, is not reported.
  onPress: (press: OverviewPress) => void
}

export interface ScrubMarkerProps {
  // [lng, lat] of the point being scrubbed on the elevation graph.
  coordinate: [number, number]
  color: string
  radius: number
  strokeColor: string
  strokeWidth: number
}

export interface TerrainProps {
  exaggeration: number
}

export interface UserPuckProps {
  // Scale factor applied to the puck's bearing image (source is high-resolution, scaled down).
  scale: number
}

export interface MapViewProps {
  styleURL: string
  // Fires as the camera moves.
  onCameraChanged?: (framing: CameraFraming) => void
  // Fires once the map has loaded its style and is on screen; may fire again after a style change.
  onMapLoaded?: () => void
  children?: React.ReactNode
  style?: StyleProp<ViewStyle>
}

// The imperative camera affordances: one-shot moves with no declarative equivalent. Both are only
// meaningful when follow is off — an imperative move is a no-op while rnmapbox is following, and the
// compass-follow case is handled by a declarative follow demote instead.
export interface CameraController {
  resetNorth(animated: boolean): void
  // One-shot fit to a geographic box (used to frame a selected trail). padding is
  // [top, right, bottom, left] in points, the whole room left around the box, whatever padding the
  // camera holds from following; duration in ms. Like resetNorth, only meaningful when follow is
  // off (an imperative camera move is a no-op while rnmapbox is following).
  // pitch travels with the fit, which is how a fit flattens: a camera stop without one keeps
  // whatever pitch the native camera has.
  // heading is the camera's current one, kept: the box is framed as it turns on screen.
  // maxZoom is the closest the fit may come, as for a cluster's starts that never split; the
  // provider's own maximum when absent.
  fitBounds(
    ne: [number, number],
    sw: [number, number],
    padding: EdgePadding,
    duration: number,
    pitch: number,
    heading: number,
    maxZoom?: number,
  ): void
}

export interface MapComponents {
  View: React.ComponentType<MapViewProps>
  Camera: React.ForwardRefExoticComponent<CameraProps & React.RefAttributes<CameraController>>
  Terrain: React.ComponentType<TerrainProps>
  UserPuck: React.ComponentType<UserPuckProps>
  RouteOverlay: React.ComponentType<RouteOverlayProps>
  ScrubMarker: React.ComponentType<ScrubMarkerProps>
  Overview: React.ComponentType<OverviewProps>
}

export interface OfflinePackDescriptor {
  // Canonical pack name `offline:<trailId>:<styleId>`.
  id: string
  styleUrl: string
  // [ne, sw], each [lng, lat].
  bounds: [[number, number], [number, number]]
  minZoom: number
  maxZoom: number
}

export interface OfflinePackInfo {
  // The id (`offline:<trailId>:<styleId>`) is the canonical source of trail/style — parse it
  // with parsePackId rather than carrying a redundant metadata copy.
  id: string
  state: 'complete' | 'downloading' | 'incomplete' | 'error'
  percentage: number
  sizeBytes: number
}

// The offline seam: download/manage per-region tile packs. Implemented only by the
// map adapter; shared code talks to this interface. Offline is a requirement on every
// provider, not a capability: the required `offline` member on `MapProvider` below is the
// enforcement, and a provider without it does not compile. There is no capability flag
// to check — see docs/adr/0002-offline-is-a-provider-requirement.md.
export interface OfflineController {
  downloadPack(descriptor: OfflinePackDescriptor): Promise<void>
  deletePack(id: string): Promise<void>
  resumePack(id: string): Promise<void>
  listPacks(): Promise<OfflinePackInfo[]>
  // Observe an in-flight pack; returns an unsubscribe fn.
  subscribe(
    id: string,
    onProgress: (info: OfflinePackInfo) => void,
    onError: (id: string, message: string) => void,
  ): () => void
}

export interface MapProvider {
  capabilities: MapCapabilities
  components: MapComponents
  offline: OfflineController
}
