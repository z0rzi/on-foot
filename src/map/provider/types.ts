import React from 'react'

export interface StyleDescriptor {
  id: string
  label: string
  url: string
  preview: number
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
  centerCoordinate?: [number, number]
  zoomLevel?: number
  pitch?: number
  heading?: number
  followUserLocation?: boolean
  followUserMode?: 'normal' | 'compass' | 'course'
  followZoomLevel?: number
  followPitch?: number
  animationDuration?: number
  // Fires when the map's user-tracking state changes. `following` is false when a manual gesture
  // cancels follow, so the app can drop its follow mode. SDK-neutral (see adapter for mapping).
  onUserTrackingModeChange?: (following: boolean) => void
}

export interface TerrainProps {
  exaggeration: number
}

export interface MapViewProps {
  styleURL: string
  onCameraChanged?: (e: { isUserInteraction: boolean; heading: number; pitch: number }) => void
  children?: React.ReactNode
  style?: any
}

export interface CameraHandle {
  setCamera(cfg: CameraProps): void
}

export interface MapComponents {
  View: React.ComponentType<MapViewProps>
  Camera: React.ForwardRefExoticComponent<CameraProps & React.RefAttributes<CameraHandle>>
  Terrain: React.ComponentType<TerrainProps>
  UserPuck: React.ComponentType<{}>
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
