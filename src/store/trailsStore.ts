import { create } from 'zustand'
import { NewTrailInput, Trail, TrailSummary, TrailUpdate, trailsRepository } from '../data/trails'
import { useActivitiesStore } from './activitiesStore'

interface TrailsStore {
  trails: TrailSummary[]
  version: number
  loadTrails: () => Promise<void>
  getTrail: (id: number) => Promise<Trail | null>
  addTrail: (input: NewTrailInput) => Promise<number>
  updateTrail: (id: number, update: TrailUpdate) => Promise<void>
  removeTrail: (id: number) => Promise<void>
}

export const useTrailsStore = create<TrailsStore>((set, get) => {
  // Reloading the list after a mutation and bumping the version are one operation, so a
  // mutation cannot publish a change the selection revalidation misses. `loadTrails` on its
  // own — the focus refresh — deliberately leaves the version alone.
  const commit = async () => {
    await get().loadTrails()
    set((s) => ({ version: s.version + 1 }))
  }

  return {
    trails: [],
    version: 0,
    loadTrails: async () => {
      set({ trails: await trailsRepository.listSummaries() })
    },
    getTrail: (id) => trailsRepository.getTrail(id),
    addTrail: async (input) => {
      const id = await trailsRepository.createTrail(input)
      await commit()
      return id
    },
    updateTrail: async (id, update) => {
      await trailsRepository.updateTrail(id, update)
      await commit()
    },
    removeTrail: async (id) => {
      await trailsRepository.deleteTrail(id)
      // The trails still reload if the activities publication fails.
      try {
        await useActivitiesStore.getState().publishTrailDeleted()
      } finally {
        await commit()
      }
    },
  }
})
