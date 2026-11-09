import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

export type PaceSpeedMode = 'pace' | 'speed'

// Display only: widens the slope-colour bands on the elevation graph and the map route. It never
// reaches stored metrics (see elevation/slope.ts displaySlopeBands, architecture/importRules).
export const ELEVATION_SMOOTHING_PRESETS = [0, 25, 50, 100, 200] as const

export function nextPaceSpeedMode(mode: PaceSpeedMode): PaceSpeedMode {
  return mode === 'pace' ? 'speed' : 'pace'
}

interface PreferencesStore {
  paceSpeedMode: PaceSpeedMode
  togglePaceSpeed: () => void
  elevationSmoothingMeters: number
  setElevationSmoothing: (meters: number) => void
}

export const usePreferencesStore = create<PreferencesStore>()(
  persist(
    (set) => ({
      paceSpeedMode: 'pace',
      togglePaceSpeed: () => set((s) => ({ paceSpeedMode: nextPaceSpeedMode(s.paceSpeedMode) })),
      elevationSmoothingMeters: 50,
      setElevationSmoothing: (meters) => set({ elevationSmoothingMeters: meters }),
    }),
    {
      name: 'onfoot-preferences',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        paceSpeedMode: s.paceSpeedMode,
        elevationSmoothingMeters: s.elevationSmoothingMeters,
      }),
    },
  ),
)
