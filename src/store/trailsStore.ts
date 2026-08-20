import { create } from 'zustand'
import { NewTrailInput, TrailSummary, trailsRepository } from '../data/trails'

interface TrailsStore {
  trails: TrailSummary[]
  loadTrails: () => Promise<void>
  addTrail: (input: NewTrailInput) => Promise<number>
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
  removeTrail: async (id) => {
    await trailsRepository.deleteTrail(id)
    await get().loadTrails()
  },
}))
