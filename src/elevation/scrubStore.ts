import { create } from 'zustand'

export interface ScrubPoint { lat: number; lng: number }

interface ScrubStore {
  point: ScrubPoint | null
  setPoint: (point: ScrubPoint | null) => void
}

export const useScrubStore = create<ScrubStore>((set) => ({
  point: null,
  setPoint: (point) => set({ point }),
}))
