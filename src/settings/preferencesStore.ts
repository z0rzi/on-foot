import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

export type PaceSpeedMode = 'pace' | 'speed'

export function nextPaceSpeedMode(mode: PaceSpeedMode): PaceSpeedMode {
  return mode === 'pace' ? 'speed' : 'pace'
}

interface PreferencesStore {
  paceSpeedMode: PaceSpeedMode
  togglePaceSpeed: () => void
}

export const usePreferencesStore = create<PreferencesStore>()(
  persist(
    (set) => ({
      paceSpeedMode: 'pace',
      togglePaceSpeed: () => set((s) => ({ paceSpeedMode: nextPaceSpeedMode(s.paceSpeedMode) })),
    }),
    {
      name: 'onfoot-preferences',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ paceSpeedMode: s.paceSpeedMode }),
    },
  ),
)
