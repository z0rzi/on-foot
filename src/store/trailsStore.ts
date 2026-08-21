import { create } from 'zustand'
import { NewTrailInput, TrailSummary, TrailUpdate, trailsRepository } from '../data/trails'

interface TrailsStore {
  trails: TrailSummary[]
  loadTrails: () => Promise<void>
  addTrail: (input: NewTrailInput) => Promise<number>
  updateTrail: (id: number, update: TrailUpdate) => Promise<void>
  removeTrail: (id: number) => Promise<void>
}

export const useTrailsStore = create<TrailsStore>((set, get) => ({
  trails: [],
  loadTrails: async () => {
    set({ trails: await trailsRepository.listSummaries() })
  },
  addTrail: async (input) => {
    const id = await trailsRepository.createTrail(input)
    await get().loadTrails()
    return id
  },
  updateTrail: async (id, update) => {
    await trailsRepository.updateTrail(id, update)
    await get().loadTrails()
  },
  removeTrail: async (id) => {
    await trailsRepository.deleteTrail(id)
    await get().loadTrails()
  },
}))
