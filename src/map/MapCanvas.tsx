import React, { useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet } from 'react-native'
import { useMapProvider, useMapCapabilities } from './provider'
import type { CameraController, EdgePadding } from './provider/types'
import { useMapStore, followCameraProps, manualPitchProps, type Selection } from '../store/mapStore'
import { useRecordingStore } from '../recording/recordingStore'
import { recordingPhase } from '../recording/recordingPhase'
import { MapTokens } from '../theme/tokens'
import type { Trail } from '../data/trails/types'
import { Activity } from '../data/activities/types'
import { groupPointsBySegment } from '../data/activities/mapping'
import { boundsForPoints, flattenSegments, pointCount, type LngLatBounds } from './geo'
import { MapOverlays, type OverlayRoute } from './MapOverlays'
import { useCurrentMapStyle } from './useCurrentMapStyle'
import { ScrubMarkerLayer } from './ScrubMarkerLayer'
import { UserPuckLayer } from './UserPuckLayer'
import { OverviewLayer } from './overview/OverviewLayer'
import { useRouteColouring } from '../elevation/useRouteColouring'
import type { RouteDisplay } from '../elevation/routeDisplay'
import { useInterruptionToast } from '../recording/useInterruptionToast'
import { useLastCameraCapture } from './useLastCameraCapture'
import { logEvent } from '../log'

// The route drawn in full dress: the activity when it has a line, else the trail.
function overlayRoute(trail: Trail | null, activity: Activity | null): OverlayRoute | null {
  if (activity && pointCount(activity.geometry.segments) >= 2) {
    return { kind: 'activity', id: activity.id, segments: activity.geometry.segments }
  }
  if (trail && pointCount(trail.geometry.segments) >= 2) return { kind: 'trail', id: trail.id, segments: trail.geometry.segments }
  return null
}

export function MapCanvas({
  trail,
  activity,
  display,
  camera,
  onOverviewList,
}: {
  trail: Trail | null
  activity: Activity | null
  display: RouteDisplay | null
  // The room the overlays leave the camera for fitting and following (cameraPadding); a fit waits
  // until it is settled.
  camera: { padding: EdgePadding; settled: boolean }
  // Several overview items under a press, to be listed (D118).
  onOverviewList: (items: Selection[]) => void
}) {
  const { components } = useMapProvider()
  const caps = useMapCapabilities()
  const style = useCurrentMapStyle()
  const { View: MapView, Camera, Terrain } = components

  // The camera is driven declaratively from the store. When a follow mode is active, rnmapbox
  // owns the camera (centres/zooms/tilts to the puck) — this is what moves to the user on a
  // following launch and recentres when the location button is tapped. When follow is off, we
  // apply the pitch a pitch control (the 2D/3D button / drag) asked for via the pitch prop. A launch starts on
  // the last camera when it has a usable one, set before the map mounts (MapLaunchGate): a free
  // launch stays there, a following one moves from there to the user.
  const followMode = useMapStore((s) => s.followMode)
  const cameraPitch = useMapStore((s) => s.cameraPitch)
  const pitchControl = useMapStore((s) => s.pitchControl)
  const disableFollow = useMapStore((s) => s.disableFollow)
  const setCameraHeading = useMapStore((s) => s.setCameraHeading)
  const northResetNonce = useMapStore((s) => s.northResetNonce)
  const pendingFit = useMapStore((s) => s.pendingFit)
  const clearPendingFit = useMapStore((s) => s.clearPendingFit)
  const cameraRef = useRef<CameraController>(null)
  const initialCamera = useMapStore((s) => s.startingCamera) ?? undefined
  const captureLastCamera = useLastCameraCapture()
  const [mapLoaded, setMapLoaded] = useState(false)
  useInterruptionToast(mapLoaded)

  // rnmapbox drops any camera move (imperative or declarative) while follow is active. The store
  // actions that trigger a one-shot camera op (northPressed / recenter / select / fitCluster) turn
  // follow off in the same commit, and these effects run the op a frame after it. The op and that
  // commit's props reach the native camera unordered, the op often first: the release of follow
  // does not cancel it, a camera stop among the props would, so those actions leave no declarative
  // pitch to send beside it (manualPitchProps).
  useEffect(() => {
    if (northResetNonce <= 0) return
    const id = requestAnimationFrame(() => cameraRef.current?.resetNorth(true))
    return () => cancelAnimationFrame(id)
  }, [northResetNonce])

  const active = useRecordingStore((s) => recordingPhase(s.session) !== 'idle')
  const livePoints = useRecordingStore((s) => s.livePoints)
  const liveSegments = useMemo(() => groupPointsBySegment(livePoints), [livePoints])
  const showLiveTrack = active && livePoints.length >= 2

  const route = useMemo(() => overlayRoute(trail, activity), [trail, activity])
  // The colouring belongs to the route being displayed, never to the live track, which keeps its
  // own colour so it reads as the live one at a glance.
  const colouredLines = useRouteColouring(route && display?.kind === route.kind ? display : null)

  // Frame the entity (trail or activity) a user tap requested, once that entity's own geometry
  // has loaded. select() sets pendingFit; the loaded trail/activity prop lags it (data resolves
  // async), so fitSegments stays null until the prop's id matches pendingFit's — switching A → B
  // skips A's stale geometry and frames B once B loads. trail.geometry.segments and
  // activity.geometry.segments are stable references for a given loaded entity, so fitSegments is
  // a sound memo dependency. A cluster's box needs nothing loaded and carries its own zoom limit.
  // pendingFit is cleared only after the deferred fit fires (not before), so the effect cleanup
  // can't cancel its own pending frame. A restored selection leaves pendingFit null, so it never
  // fits: the camera follows the user or stays on the restored camera. The fit also waits for the
  // padding to settle: the entity's pill mounts with it and is measured a frame later.
  const fitSegments =
    pendingFit?.kind === 'trail' && trail?.id === pendingFit.id
      ? trail.geometry.segments
      : pendingFit?.kind === 'activity' && activity?.id === pendingFit.id
        ? activity.geometry.segments
        : null
  const fitKind = pendingFit?.kind
  const fitBox = useMemo((): { bounds: LngLatBounds; maxZoom?: number } | null => {
    if (pendingFit?.kind === 'bounds') return pendingFit
    if (fitSegments == null) return null
    const flat = flattenSegments(fitSegments)
    if (flat.length < 2) return null
    const bounds = boundsForPoints(flat)
    return bounds && { bounds }
  }, [pendingFit, fitSegments])

  const [padTop, padRight, padBottom, padLeft] = camera.padding
  const padding = useMemo((): EdgePadding => [padTop, padRight, padBottom, padLeft], [padTop, padRight, padBottom, padLeft])
  const paddingSettled = camera.settled

  useEffect(() => {
    if (fitBox == null || !paddingSettled) return
    const { bounds, maxZoom } = fitBox
    const id = requestAnimationFrame(() => {
      const { cameraHeading } = useMapStore.getState()
      const controller = cameraRef.current
      if (controller) {
        controller.fitBounds(bounds.ne, bounds.sw, padding, MapTokens.trailFitDurationMs, cameraPitch, cameraHeading, maxZoom)
        logEvent('info', 'map', 'fit fired', { kind: fitKind })
      }
      clearPendingFit()
    })
    return () => cancelAnimationFrame(id)
  }, [fitBox, fitKind, paddingSettled, padding, clearPendingFit, cameraPitch])

  const follow = followCameraProps(followMode)
  const manualPitch = manualPitchProps(followMode, cameraPitch, pitchControl)

  return (
    <MapView
      style={StyleSheet.absoluteFill}
      styleURL={style.url}
      onCameraChanged={(framing) => {
        setCameraHeading(framing.heading)
        captureLastCamera(framing)
      }}
      onMapLoaded={() => setMapLoaded(true)}
    >
      <Camera
        ref={cameraRef}
        initialCamera={initialCamera}
        {...follow}
        followPadding={padding}
        {...manualPitch}
        // A manual pan/zoom/tilt cancels rnmapbox tracking; drop our follow mode to match so the
        // camera stays where the user left it (mirrors the Kotlin gesture listeners).
        onUserTrackingModeChange={(following) => {
          if (!following) disableFollow()
        }}
      />
      {caps.supportsTerrain && <Terrain exaggeration={MapTokens.terrainExaggeration} />}
      <UserPuckLayer />
      <OverviewLayer loadedRoute={route} onList={onOverviewList} />
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
