import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { MapTokens } from '../theme/tokens'

export type FollowMode = 'off' | 'position' | 'positionAndBearing'

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

// The camera pitch each follow mode implies, so the 2D/3D label stays in sync with the
// follow-driven camera without reading back the live camera: Position is flat (north-up 2D),
// PositionAndBearing tilts to the 3D angle (mirrors the Kotlin location-button flyTo, which
// enters PositionAndBearing at pitchToggle). 'off' leaves pitch under manual/gesture control.
export function pitchForFollowMode(mode: FollowMode, current: number): number {
  switch (mode) {
    case 'position': return MapTokens.pitchMin
    case 'positionAndBearing': return MapTokens.pitchToggle
    case 'off': return current
  }
}

// SDK-neutral <Camera> follow configuration for a given follow mode. Mirrors the Kotlin
// FollowPuckViewportState options: Position = follow location north-up & flat; PositionAndBearing
// = follow location + device heading, tilted to 3D. 'off' releases the camera to the user.
export interface FollowCameraProps {
  followUserLocation: boolean
  followUserMode?: 'normal' | 'compass' | 'course'
  followZoomLevel?: number
  followPitch?: number
}
export function followCameraProps(mode: FollowMode): FollowCameraProps {
  switch (mode) {
    case 'off':
      return { followUserLocation: false }
    case 'position':
      return {
        followUserLocation: true,
        followUserMode: 'normal',
        followZoomLevel: MapTokens.locationZoom,
        followPitch: MapTokens.pitchMin,
      }
    case 'positionAndBearing':
      return {
        followUserLocation: true,
        followUserMode: 'compass',
        followZoomLevel: MapTokens.locationZoom,
        followPitch: MapTokens.pitchToggle,
      }
  }
}

interface MapStore {
  followMode: FollowMode
  mapStyleId: string
  selectedTrailId: number | null
  hasZoomedToUser: boolean
  cameraPitch: number
  // Whether the next declarative pitch application should animate (tap toggle) or snap
  // (live drag). Session-only; drives the <Camera> animationDuration in MapCanvas.
  pitchAnimated: boolean
  cycleFollowMode: () => void
  disableFollow: () => void
  northPressed: () => void
  setMapStyle: (id: string) => void
  setSelectedTrailId: (id: number | null) => void
  setHasZoomedToUser: (v: boolean) => void
  setCameraPitch: (p: number) => void
  setCameraPitchAnimated: (p: number) => void
}

export const useMapStore = create<MapStore>()(
  persist(
    (set) => ({
      // Default to Position so the map centres and zooms to the user on launch once location is
      // granted (matches the Kotlin app's default FollowMode.Position). Not persisted, so every
      // launch re-follows.
      followMode: 'position',
      mapStyleId: 'standard',
      selectedTrailId: null,
      hasZoomedToUser: false,
      cameraPitch: 0,
      pitchAnimated: false,
      cycleFollowMode: () =>
        set((s) => {
          const followMode = nextFollowMode(s.followMode)
          return { followMode, cameraPitch: pitchForFollowMode(followMode, s.cameraPitch), pitchAnimated: true }
        }),
      disableFollow: () => set({ followMode: 'off' }),
      northPressed: () => set((s) => ({ followMode: demoteBearing(s.followMode) })),
      setMapStyle: (id) => set({ mapStyleId: id }),
      setSelectedTrailId: (id) => set({ selectedTrailId: id }),
      setHasZoomedToUser: (v) => set({ hasZoomedToUser: v }),
      setCameraPitch: (p) => set({ cameraPitch: p, pitchAnimated: false }),
      setCameraPitchAnimated: (p) => set({ cameraPitch: p, pitchAnimated: true }),
    }),
    {
      name: 'onfoot-map',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ mapStyleId: s.mapStyleId }),
    }
  )
)
