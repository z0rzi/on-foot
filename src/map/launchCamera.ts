import type { FollowMode } from '../store/mapStore'
import type { CameraFraming, FollowUserMode, MapCapabilities } from './provider/types'

type ZoomRange = Pick<MapCapabilities, 'minZoom' | 'maxZoom'>

type LastCameraFault = 'non-finite' | 'out-of-range'

function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n)
}

// Why a persisted last camera cannot be restored, or null when it can. Total over whatever storage
// held, so a value from an older shape is a fault, never a throw. Pitch and heading are only
// checked for finiteness: the provider clamps pitch, and heading is an angle.
export function lastCameraFault(camera: CameraFraming, range: ZoomRange): LastCameraFault | null {
  const [lng, lat] = Array.isArray(camera.center) ? camera.center : []
  if (
    !isFiniteNumber(lng) ||
    !isFiniteNumber(lat) ||
    ![camera.zoom, camera.pitch, camera.heading].every(isFiniteNumber)
  ) {
    return 'non-finite'
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return 'out-of-range'
  if (camera.zoom < range.minZoom || camera.zoom > range.maxZoom) return 'out-of-range'
  return null
}

type LaunchCamera =
  | { kind: 'follow'; mode: FollowUserMode; invalid?: LastCameraFault | 'missing' }
  | { kind: 'restore'; camera: CameraFraming }

// What the camera does at launch, from the hydrated follow state and last camera: following at the
// last leave follows again in the same mode; free restores the last camera, or falls back to
// position follow when it cannot be restored.
export function launchCamera(followMode: FollowMode, lastCamera: CameraFraming | null, range: ZoomRange): LaunchCamera {
  if (followMode !== 'off') return { kind: 'follow', mode: followMode }
  if (lastCamera == null) return { kind: 'follow', mode: 'position', invalid: 'missing' }
  const fault = lastCameraFault(lastCamera, range)
  if (fault != null) return { kind: 'follow', mode: 'position', invalid: fault }
  return { kind: 'restore', camera: lastCamera }
}
