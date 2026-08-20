import { create } from 'zustand'
import { NewTrailInput, TrailSummary, trailsRepository } from '../data/trails'

interface TrailsStore {
  trails: TrailSummary[]
  loading: boolean
  loadTrails: () => Promise<void>
  addTrail: (input: NewTrailInput) => Promise<number>
  removeTrail: (id: number) => Promise<void>
}

export const useTrailsStore = create<TrailsStore>((set, get) => ({
  trails: [],
  loading: false,
  loadTrails: async () => {
    set({ loading: true })
    const trails = await trailsRepository.listSummaries()
    set({ trails, loading: false })
  },
  addTrail: async (input) => {
    const id = await trailsRepository.createTrail(input)
    await get().loadTrails()
    return id
  },
  removeTrail: async (id) => {
    await trailsRepository.deleteTrail(id)
    set((s) => ({ trails: s.trails.filter((t) => t.id !== id) }))
  },
}))
