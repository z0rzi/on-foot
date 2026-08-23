import React from 'react'

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

export interface TrailOverlayProps {
  // Trail polyline as [lng, lat] pairs, in trail order.
  line: [number, number][]
  // [start, end] as [lng, lat]; drawn as dot markers.
  endpoints: [number, number][]
  color: string
  lineWidth: number
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
  // Polyline as [lng, lat] pairs, in order. A plain line — no arrows or endpoints.
  line: [number, number][]
  color: string
  lineWidth: number
}

export interface TerrainProps {
  exaggeration: number
}

export interface MapViewProps {
  styleURL: string
  // Fires as the camera moves; heading only (all the North button needs). SDK-neutral.
  onCameraChanged?: (e: { heading: number }) => void
  children?: React.ReactNode
  style?: any
}

// The one imperative camera affordance: a one-shot rotate back to north, used only when
// follow is off (a declarative follow demote handles the compass-follow case).
export interface CameraController {
  resetNorth(animated: boolean): void
  // One-shot fit to a geographic box (used to frame a selected trail). padding is
  // [top, right, bottom, left] in points; duration in ms. Like resetNorth, only meaningful
  // when follow is off (an imperative camera move is a no-op while rnmapbox is following).
  fitBounds(
    ne: [number, number],
    sw: [number, number],
    padding: [number, number, number, number],
    duration: number,
  ): void
}

export interface MapComponents {
  View: React.ComponentType<MapViewProps>
  Camera: React.ForwardRefExoticComponent<CameraProps & React.RefAttributes<CameraController>>
  Terrain: React.ComponentType<TerrainProps>
  UserPuck: React.ComponentType<{}>
  TrailOverlay: React.ComponentType<TrailOverlayProps>
  RouteLine: React.ComponentType<RouteLineProps>
}

export interface MapProvider {
  capabilities: MapCapabilities
  components: MapComponents
}

export function isValidCapabilities(c: any): boolean {
  return (
    !!c &&
    typeof c.id === 'string' &&
    typeof c.requiresToken === 'boolean' &&
    typeof c.supportsTerrain === 'boolean' &&
    typeof c.supportsDataDrivenLayers === 'boolean' &&
    typeof c.offline === 'boolean' &&
    Array.isArray(c.styles) &&
    c.styles.length > 0
  )
}
