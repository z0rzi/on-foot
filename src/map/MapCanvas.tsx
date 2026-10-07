import React, { useEffect, useMemo, useRef } from 'react'
import { StyleSheet } from 'react-native'
import { useMapProvider, useMapCapabilities } from './provider'
import type { CameraController } from './provider/types'
import { useMapStore, followCameraProps } from '../store/mapStore'
import { useRecordingStore, recordingPhase } from '../recording/recordingStore'
import { MapTokens } from '../theme/tokens'
import { Trail } from '../data/trails'
import { Activity } from '../data/activities/types'
import { groupPointsBySegment } from '../data/activities/mapping'
import { boundsForPoints, flattenSegments } from './geo'
import { MapOverlays, type OverlayRoute } from './MapOverlays'
import { ScrubMarkerLayer } from './ScrubMarkerLayer'
import { useRouteColouring } from '../elevation/useRouteColouring'
import type { RouteDisplay } from '../elevation/routeDisplay'

// Counts points without allocating the flattened copy flattenSegments would build.
function pointCount<T>(segments: T[][]): number {
  return segments.reduce((total, segment) => total + segment.length, 0)
}

export function MapCanvas({
  trail,
  activity,
  display,
}: {
  trail: Trail | null
  activity: Activity | null
  display: RouteDisplay | null
}) {
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

  // rnmapbox drops any camera move (imperative or declarative) while follow is active, and a
  // programmatic follow-off only reaches the native camera on the next frame. The store actions
  // that trigger a one-shot camera op (northPressed / recenter / select) turn follow off in the
  // same commit, so these effects run the imperative op one frame later — by which point follow is
  // released and the move lands. Running it synchronously here races the follow-off and is swallowed.
  useEffect(() => {
    if (northResetNonce <= 0) return
    const id = requestAnimationFrame(() => cameraRef.current?.resetNorth(true))
    return () => cancelAnimationFrame(id)
  }, [northResetNonce])

  const segments = trail?.geometry.segments ?? []
  const hasTrail = pointCount(segments) >= 2

  const activitySegments = activity?.geometry.segments ?? []
  const hasActivity = pointCount(activitySegments) >= 2

  const active = useRecordingStore((s) => recordingPhase(s.session) !== 'idle')
  const livePoints = useRecordingStore((s) => s.livePoints)
  const liveSegments = useMemo(() => groupPointsBySegment(livePoints), [livePoints])
  const showLiveTrack = active && livePoints.length >= 2

  const route: OverlayRoute | null = hasActivity
    ? { segments: activitySegments, kind: 'activity' }
    : hasTrail
      ? { segments, kind: 'trail' }
      : null
  const colouredLines = useRouteColouring(route ? display : null)

  // Frame the entity (trail or activity) a user tap requested, once that entity's own geometry
  // has loaded. select() sets pendingFit; the loaded trail/activity prop lags it (data resolves
  // async), so fitSegments stays null until the prop's id matches pendingFit's — switching A → B
  // skips A's stale geometry and frames B once B loads. trail.geometry.segments and
  // activity.geometry.segments are stable references for a given loaded entity, so fitSegments is
  // a sound effect dependency. pendingFit is cleared only after the deferred fit fires (not
  // before), so the effect cleanup can't cancel its own pending frame. A restored selection leaves
  // pendingFit null, so it never fits and the camera keeps following the user.
  const fitSegments =
    pendingFit?.kind === 'trail' && trail?.id === pendingFit.id
      ? trail.geometry.segments
      : pendingFit?.kind === 'activity' && activity?.id === pendingFit.id
        ? activity.geometry.segments
        : null

  useEffect(() => {
    if (fitSegments == null) return
    const flat = flattenSegments(fitSegments)
    if (flat.length < 2) return
    const bounds = boundsForPoints(flat)
    if (!bounds) return
    const { top, sides, bottom } = MapTokens.cameraPadding
    const id = requestAnimationFrame(() => {
      cameraRef.current?.fitBounds(bounds.ne, bounds.sw, [top, sides, bottom, sides], MapTokens.trailFitDurationMs, cameraPitch)
      clearPendingFit()
    })
    return () => cancelAnimationFrame(id)
  }, [fitSegments, clearPendingFit, cameraPitch])

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
      <MapOverlays
        route={route}
        liveSegments={liveSegments}
        showLiveTrack={showLiveTrack}
        colouredLines={colouredLines}
      />
      <ScrubMarkerLayer />
    </MapView>
  )
}
