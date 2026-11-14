import { create, type Mutate, type StoreApi, type UseBoundStore } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { errorClass, logEvent } from '../log'
import { writesAfterHydration } from '../store/writesAfterHydration'

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

type PersistedPreferences = Pick<PreferencesStore, 'paceSpeedMode' | 'elevationSmoothingMeters'>

// Annotated because the storage reads the store's own hydration status.
type PreferencesStoreHook = UseBoundStore<
  Mutate<StoreApi<PreferencesStore>, [['zustand/persist', PersistedPreferences]]>
>

export const usePreferencesStore: PreferencesStoreHook = create<PreferencesStore>()(
  persist(
    (set) => ({
      paceSpeedMode: 'pace',
      togglePaceSpeed: () => set((s) => ({ paceSpeedMode: nextPaceSpeedMode(s.paceSpeedMode) })),
      elevationSmoothingMeters: 50,
      setElevationSmoothing: (meters) => set({ elevationSmoothingMeters: meters }),
    }),
    {
      name: 'onfoot-preferences',
      storage: writesAfterHydration(
        createJSONStorage<PersistedPreferences>(() => AsyncStorage),
        () => usePreferencesStore.persist.hasHydrated(),
      ),
      partialize: (s) => ({
        paceSpeedMode: s.paceSpeedMode,
        elevationSmoothingMeters: s.elevationSmoothingMeters,
      }),
      // Defaults are a complete state, so nothing waits on hydration: a failure is only logged.
      onRehydrateStorage: () => (_, error) => {
        if (error) logEvent('warn', 'launch', 'preferences hydration failed, defaults used', { errorClass: errorClass(error) })
      },
    },
  ),
)
