import { create } from 'zustand'
import type { OfflineController, OfflinePackInfo } from '../provider/types'
import type { LiveProgress } from './types'

interface OfflineStore {
  packs: OfflinePackInfo[]
  progress: Record<string, LiveProgress>
  refreshPacks: (controller: OfflineController) => Promise<void>
  setProgress: (id: string, percentage: number, failed: boolean) => void
  clearProgress: (id: string) => void
}

export const useOfflineStore = create<OfflineStore>((set) => ({
  packs: [],
  progress: {},
  refreshPacks: async (controller) => {
    set({ packs: await controller.listPacks() })
  },
  setProgress: (id, percentage, failed) =>
    set((s) => ({ progress: { ...s.progress, [id]: { percentage, failed } } })),
  clearProgress: (id) =>
    set((s) => {
      const next = { ...s.progress }
      delete next[id]
      return { progress: next }
    }),
}))
