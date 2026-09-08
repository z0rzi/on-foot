import React from 'react'
import type { StyleProp, ViewStyle } from 'react-native'

export interface StyleDescriptor {
  id: string
  label: string
  url: string
  preview: number
  // Semantic marker: this style is the provider's satellite/aerial-imagery layer. Declared on
  // the port so provider-agnostic code (the store's quick-switch logic) can identify it without
  // hardcoding a provider-specific style id. A future provider marks its own imagery style.
  satellite?: boolean
}

export interface MapCapabilities {
  id: string
  requiresToken: boolean
  supportsTerrain: boolean
  supportsDataDrivenLayers: boolean
  offline: boolean
  styles: StyleDescriptor[]
}

export interface CameraProps {
  pitch?: number
  followUserLocation?: boolean
  followUserMode?: 'normal' | 'compass' | 'course'
  followZoomLevel?: number
  followPitch?: number
  animationDuration?: number
  // Fires when the map's user-tracking state changes. `following` is false when a manual gesture
  // cancels follow, so the app can drop its follow mode. SDK-neutral (see adapter for mapping).
  onUserTrackingModeChange?: (following: boolean) => void
}

export interface ColouredLine {
  coordinates: [number, number][]
  color: string
}

export interface TrailOverlayProps {
  // Track segments as a MultiLineString: each entry is one segment's [lng, lat] pairs, in order.
  lines: [number, number][][]
  // Dashed connectors bridging consecutive segment endpoints; carry no distance.
  connectors: [number, number][][]
  connectorDashArray: number[]
  // [start, end] as [lng, lat]; drawn as dot markers.
  endpoints: [number, number][]
  color: string
  lineWidth: number
  // When set, per-slope coloured polylines drawn instead of the single-colour `lines` (each
  // carries its own colour; the adapter draws them with a data-driven line colour). Stays
  // provider- and slope-agnostic: shared code maps slope band → colour before it reaches here.
  colouredLines?: ColouredLine[]
  // Directional arrows are optional: omit arrowImage to render a plain trail line + endpoints
  // (used for recorded activity tracks, where arrows on noisy GPS look cluttered).
  arrowImage?: number
  arrowSpacing?: number
  arrowSize?: number
  endpointRadius: number
  endpointStrokeColor: string
  endpointStrokeWidth: number
}

export interface RouteLineProps {
  lines: [number, number][][]
  connectors: [number, number][][]
  connectorDashArray: number[]
  color: string
  lineWidth: number
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
  // Fires as the camera moves; heading only (all the North button needs). SDK-neutral.
  onCameraChanged?: (e: { heading: number }) => void
  children?: React.ReactNode
  style?: StyleProp<ViewStyle>
}

// The one imperative camera affordance: a one-shot rotate back to north, used only when
// follow is off (a declarative follow demote handles the compass-follow case).
export interface CameraController {
  resetNorth(animated: boolean): void
  // One-shot fit to a geographic box (used to frame a selected trail). padding is
  // [top, right, bottom, left] in points; duration in ms. Like resetNorth, only meaningful
  // when follow is off (an imperative camera move is a no-op while rnmapbox is following).
  // pitch travels with the fit: a bounds-only camera stop keeps whatever pitch the native camera
  // has, and being the later op it would override the declarative pitch the store just set.
  fitBounds(
    ne: [number, number],
    sw: [number, number],
    padding: [number, number, number, number],
    duration: number,
    pitch: number,
  ): void
}

export interface MapComponents {
  View: React.ComponentType<MapViewProps>
  Camera: React.ForwardRefExoticComponent<CameraProps & React.RefAttributes<CameraController>>
  Terrain: React.ComponentType<TerrainProps>
  UserPuck: React.ComponentType<UserPuckProps>
  TrailOverlay: React.ComponentType<TrailOverlayProps>
  RouteLine: React.ComponentType<RouteLineProps>
  ScrubMarker: React.ComponentType<ScrubMarkerProps>
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
// map adapter; shared code talks to this interface. The capability flag `offline`
// gates whether it is meaningful for a given provider.
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

export function isValidCapabilities(c: unknown): boolean {
  if (typeof c !== 'object' || c === null) return false
  const o = c as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.requiresToken === 'boolean' &&
    typeof o.supportsTerrain === 'boolean' &&
    typeof o.supportsDataDrivenLayers === 'boolean' &&
    typeof o.offline === 'boolean' &&
    Array.isArray(o.styles) &&
    o.styles.length > 0
  )
}
