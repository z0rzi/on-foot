import { create } from 'zustand'
import { ActivitySummary, NewActivityInput, activitiesRepository } from '../data/activities'

interface ActivitiesStore {
  activities: ActivitySummary[]
  version: number
  loadActivities: () => Promise<void>
  saveActivity: (sessionId: number, input: NewActivityInput) => Promise<number>
  removeActivity: (id: number) => Promise<void>
}

export const useActivitiesStore = create<ActivitiesStore>((set, get) => {
  // Reloading the list after a mutation and bumping the version are one operation, so a
  // mutation cannot publish a change the selection revalidation misses. `loadActivities` on
  // its own — the focus refresh — deliberately leaves the version alone.
  const commit = async () => {
    await get().loadActivities()
    set((s) => ({ version: s.version + 1 }))
  }

  return {
    activities: [],
    version: 0,
    loadActivities: async () => {
      set({ activities: await activitiesRepository.listSummaries() })
    },
    saveActivity: async (sessionId, input) => {
      const id = await activitiesRepository.saveActivity(sessionId, input)
      await commit()
      return id
    },
    removeActivity: async (id) => {
      await activitiesRepository.deleteActivity(id)
      await commit()
    },
  }
})
