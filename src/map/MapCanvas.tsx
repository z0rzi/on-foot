import React, { useEffect, useRef } from 'react'
import { StyleSheet } from 'react-native'
import { useMapProvider, useMapCapabilities } from './provider'
import type { CameraController } from './provider/types'
import { useMapStore, followCameraProps } from '../store/mapStore'
import { MapTokens } from '../theme/tokens'

export function MapCanvas() {
  const { components } = useMapProvider()
  const caps = useMapCapabilities()
  const styleId = useMapStore((s) => s.mapStyleId)
  const style = caps.styles.find((s) => s.id === styleId) ?? caps.styles[0]
  const { View: MapView, Camera, Terrain, UserPuck } = components

  // The camera is driven declaratively from the store. When a follow mode is active, rnmapbox
  // owns the camera (centres/zooms/tilts to the puck) — this is what auto-zooms to the user on
  // launch and recentres when the location button is tapped. When follow is off, we apply the
  // manual pitch (from the 2D/3D button / drag) via the pitch prop.
  const followMode = useMapStore((s) => s.followMode)
  const cameraPitch = useMapStore((s) => s.cameraPitch)
  const pitchAnimated = useMapStore((s) => s.pitchAnimated)
  const disableFollow = useMapStore((s) => s.disableFollow)
  const setCameraHeading = useMapStore((s) => s.setCameraHeading)
  const northResetNonce = useMapStore((s) => s.northResetNonce)
  const cameraRef = useRef<CameraController>(null)

  // The North button (in MapControls) signals an off-mode reset by bumping northResetNonce;
  // fire the one-shot imperative rotate-to-north here, where the Camera ref lives.
  useEffect(() => {
    if (northResetNonce > 0) cameraRef.current?.resetNorth(true)
  }, [northResetNonce])

  const follow = followCameraProps(followMode)
  const manualPitch =
    followMode === 'off'
      ? { pitch: cameraPitch, animationDuration: pitchAnimated ? 300 : 0 }
      : {}

  return (
    <MapView
      style={StyleSheet.absoluteFill}
      styleURL={style.url}
      onCameraChanged={(e) => setCameraHeading(e.heading)}
    >
      <Camera
        ref={cameraRef}
        {...follow}
        {...manualPitch}
        // A manual pan/zoom/tilt cancels rnmapbox tracking; drop our follow mode to match so the
        // camera stays where the user left it (mirrors the Kotlin gesture listeners).
        onUserTrackingModeChange={(following) => {
          if (!following) disableFollow()
        }}
      />
      {caps.supportsTerrain && <Terrain exaggeration={MapTokens.terrainExaggeration} />}
      <UserPuck />
    </MapView>
  )
}
