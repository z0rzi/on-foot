import React, { useEffect, useRef } from 'react'
import { StyleSheet } from 'react-native'
import { useMapProvider, useMapCapabilities } from './provider'
import type { CameraController } from './provider/types'
import { useMapStore, followCameraProps } from '../store/mapStore'
import { useRecordingStore, recordingPhase } from '../recording/recordingStore'
import { MapTokens } from '../theme/tokens'
import { Trail } from '../data/trails'
import { Activity } from '../data/activities/types'
import { boundsForPoints, flattenSegments } from './geo'
import { MapOverlays, type OverlayRoute } from './MapOverlays'

export function MapCanvas({ trail, activity }: { trail: Trail | null; activity: Activity | null }) {
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
  const pendingFit = useMapStore((s) => s.pendingFit)
  const clearPendingFit = useMapStore((s) => s.clearPendingFit)
  const cameraRef = useRef<CameraController>(null)

  useEffect(() => {
    if (northResetNonce > 0) cameraRef.current?.resetNorth(true)
  }, [northResetNonce])

  const segments = trail?.geometry.segments ?? []
  const hasTrail = flattenSegments(segments).length >= 2

  const activitySegments = activity?.geometry.segments ?? []
  const hasActivity = flattenSegments(activitySegments).length >= 2

  const active = useRecordingStore((s) => recordingPhase(s.session) !== 'idle')
  const liveSegments = useRecordingStore((s) => s.liveGeometry.segments)
  const showLiveTrack = active && flattenSegments(liveSegments).length >= 2

  const route: OverlayRoute | null = hasActivity
    ? { segments: activitySegments, kind: 'activity' }
    : hasTrail
      ? { segments, kind: 'trail' }
      : null

  // Frame the trail a user tap requested, once that trail's own geometry has loaded. select()
  // sets pendingFit; the loaded trail prop lags it (getTrail resolves async), so the fit waits
  // until trail.id matches — switching A → B skips A's stale geometry and frames B once B loads.
  // Clearing pendingFit once fitted stops it re-firing. A restored selection leaves pendingFit
  // null, so it never fits and the camera keeps following the user.
  useEffect(() => {
    if (trail == null || pendingFit?.kind !== 'trail' || pendingFit.id !== trail.id) return
    const flat = flattenSegments(trail.geometry.segments)
    if (flat.length < 2) return
    const bounds = boundsForPoints(flat)
    if (!bounds) return
    clearPendingFit()
    const { top, sides, bottom } = MapTokens.cameraPadding
    cameraRef.current?.fitBounds(bounds.ne, bounds.sw, [top, sides, bottom, sides], MapTokens.trailFitDurationMs)
  }, [trail, pendingFit, clearPendingFit])

  useEffect(() => {
    if (activity == null || pendingFit?.kind !== 'activity' || pendingFit.id !== activity.id) return
    const flat = flattenSegments(activity.geometry.segments)
    if (flat.length < 2) return
    const bounds = boundsForPoints(flat)
    if (!bounds) return
    clearPendingFit()
    const { top, sides, bottom } = MapTokens.cameraPadding
    cameraRef.current?.fitBounds(bounds.ne, bounds.sw, [top, sides, bottom, sides], MapTokens.trailFitDurationMs)
  }, [activity, pendingFit, clearPendingFit])

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
      <UserPuck scale={MapTokens.puckBearingScale} />
      <MapOverlays route={route} liveSegments={liveSegments} showLiveTrack={showLiveTrack} />
    </MapView>
  )
}
