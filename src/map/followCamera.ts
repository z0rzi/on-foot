import { MapTokens } from '../theme/tokens'
import type { CameraProps, FollowUserMode } from './provider/types'

export type FollowMode = 'off' | FollowUserMode

export function nextFollowMode(current: FollowMode): FollowMode {
  switch (current) {
    case 'off': return 'position'
    case 'position': return 'positionAndBearing'
    case 'positionAndBearing': return 'position'
  }
}

export function demoteBearing(current: FollowMode): FollowMode {
  return current === 'positionAndBearing' ? 'position' : current
}

// Pure toggle helper for the 2D/3D control: when flat (<= pitchMin), toggling
// animates up to pitchToggle; when tilted, toggling flattens back to pitchMin.
export function nextPitchOnToggle(current: number): number {
  return current <= MapTokens.pitchMin ? MapTokens.pitchToggle : MapTokens.pitchMin
}

// Clamp a live-drag pitch target into the allowed [pitchMin, pitchMax] range.
export function clampPitch(v: number): number {
  return Math.min(MapTokens.pitchMax, Math.max(MapTokens.pitchMin, v))
}

// Normalize any angle (degrees) to the half-open range (-180, 180], so 359° reads as -1°.
function normalizeDeg(deg: number): number {
  const m = ((deg % 360) + 360) % 360 // [0, 360)
  return m > 180 ? m - 360 : m
}

// The North button shows when the map camera is rotated more than `threshold` degrees off
// north (either direction). Pure so it can drive a re-render-cheap derived selector.
export function shouldShowNorthButton(heading: number, threshold: number): boolean {
  return Math.abs(normalizeDeg(heading)) > threshold
}

// The camera pitch each follow mode implies, so the 2D/3D label stays in sync with the
// follow-driven camera without reading back the live camera: Position is flat (north-up 2D),
// PositionAndBearing tilts to the 3D angle (mirrors the Kotlin location-button flyTo, which
// enters PositionAndBearing at pitchToggle). 'off' leaves pitch under manual/gesture control.
function pitchForFollowMode(mode: FollowMode, current: number): number {
  switch (mode) {
    case 'position': return MapTokens.pitchMin
    case 'positionAndBearing': return MapTokens.pitchToggle
    case 'off': return current
  }
}

// A follow-mode change also syncs the pitch that mode implies, so the 2D/3D label stays consistent
// with the follow-driven camera, which brings the camera there itself (no pitch control). Shared by
// every mapStore action that changes followMode, so they can't drift out of sync.
interface FollowModeChange {
  followMode: FollowMode
  cameraPitch: number
  pitchControl: null
}
export function followModeChange(mode: FollowMode, currentPitch: number): FollowModeChange {
  return { followMode: mode, cameraPitch: pitchForFollowMode(mode, currentPitch), pitchControl: null }
}

// SDK-neutral <Camera> follow configuration for a given follow mode. Mirrors the Kotlin
// FollowPuckViewportState options: Position = follow location north-up & flat; PositionAndBearing
// = follow location + device heading, tilted to 3D. 'off' releases the camera to the user.
type FollowCameraProps = Required<Pick<CameraProps, 'followUserLocation'>> &
  Pick<CameraProps, 'followUserMode' | 'followZoomLevel' | 'followPitch'>
export function followCameraProps(mode: FollowMode): FollowCameraProps {
  switch (mode) {
    case 'off':
      return { followUserLocation: false }
    case 'position':
      return {
        followUserLocation: true,
        followUserMode: 'position',
        followZoomLevel: MapTokens.locationZoom,
        followPitch: MapTokens.pitchMin,
      }
    case 'positionAndBearing':
      return {
        followUserLocation: true,
        followUserMode: 'positionAndBearing',
        followZoomLevel: MapTokens.locationZoom,
        followPitch: MapTokens.pitchToggle,
      }
  }
}

// How a pitch control (the 2D/3D toggle, the tilt drag) last set the pitch: eased or live.
export type PitchControl = 'animated' | 'live'

// The declarative pitch the camera is given: a pitch control's, once follow is off. None when the
// pitch was last set otherwise (a follow mode, a fit, the launch camera), which brings the camera
// there itself. rnmapbox turns a pitch prop into a camera stop of its own, sent with the commit's
// other props, and the native camera gets those and an imperative move unordered: a pitch prop
// appearing with the follow-off of a fit could land after the fit and cancel it.
export function manualPitchProps(
  mode: FollowMode,
  pitch: number,
  control: PitchControl | null,
): Pick<CameraProps, 'pitch' | 'animationDuration'> {
  if (mode !== 'off' || control === null) return {}
  return { pitch, animationDuration: control === 'animated' ? 300 : 0 }
}
