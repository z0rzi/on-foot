import { create } from 'zustand'
import { ActivitySummary, NewActivityInput, activitiesRepository } from '../data/activities'

interface ActivitiesStore {
  activities: ActivitySummary[]
  loadActivities: () => Promise<void>
  saveActivity: (sessionId: number, input: NewActivityInput) => Promise<number>
  removeActivity: (id: number) => Promise<void>
}

export const useActivitiesStore = create<ActivitiesStore>((set, get) => ({
  activities: [],
  loadActivities: async () => {
    set({ activities: await activitiesRepository.listSummaries() })
  },
  saveActivity: async (sessionId, input) => {
    const id = await activitiesRepository.saveActivity(sessionId, input)
    await get().loadActivities()
    return id
  },
  removeActivity: async (id) => {
    await activitiesRepository.deleteActivity(id)
    await get().loadActivities()
  },
}))
