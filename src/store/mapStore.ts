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

interface MapStore {
  followMode: FollowMode
  mapStyleId: string
  selectedTrailId: number | null
  hasZoomedToUser: boolean
  cameraPitch: number
  cycleFollowMode: () => void
  disableFollow: () => void
  northPressed: () => void
  setMapStyle: (id: string) => void
  setSelectedTrailId: (id: number | null) => void
  setHasZoomedToUser: (v: boolean) => void
  setCameraPitch: (p: number) => void
}

export const useMapStore = create<MapStore>()(
  persist(
    (set) => ({
      followMode: 'off',
      mapStyleId: 'standard',
      selectedTrailId: null,
      hasZoomedToUser: false,
      cameraPitch: 0,
      cycleFollowMode: () => set((s) => ({ followMode: nextFollowMode(s.followMode) })),
      disableFollow: () => set({ followMode: 'off' }),
      northPressed: () => set((s) => ({ followMode: demoteBearing(s.followMode) })),
      setMapStyle: (id) => set({ mapStyleId: id }),
      setSelectedTrailId: (id) => set({ selectedTrailId: id }),
      setHasZoomedToUser: (v) => set({ hasZoomedToUser: v }),
      setCameraPitch: (p) => set({ cameraPitch: p }),
    }),
    {
      name: 'onfoot-map',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ mapStyleId: s.mapStyleId }),
    }
  )
)
