import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

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

interface MapStore {
  followMode: FollowMode
  mapStyleId: string
  selectedTrailId: number | null
  hasZoomedToUser: boolean
  cycleFollowMode: () => void
  disableFollow: () => void
  northPressed: () => void
  setMapStyle: (id: string) => void
  setSelectedTrailId: (id: number | null) => void
  setHasZoomedToUser: (v: boolean) => void
}

export const useMapStore = create<MapStore>()(
  persist(
    (set) => ({
      followMode: 'off',
      mapStyleId: 'standard',
      selectedTrailId: null,
      hasZoomedToUser: false,
      cycleFollowMode: () => set((s) => ({ followMode: nextFollowMode(s.followMode) })),
      disableFollow: () => set({ followMode: 'off' }),
      northPressed: () => set((s) => ({ followMode: demoteBearing(s.followMode) })),
      setMapStyle: (id) => set({ mapStyleId: id }),
      setSelectedTrailId: (id) => set({ selectedTrailId: id }),
      setHasZoomedToUser: (v) => set({ hasZoomedToUser: v }),
    }),
    {
      name: 'onfoot-map',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ mapStyleId: s.mapStyleId }),
    }
  )
)
