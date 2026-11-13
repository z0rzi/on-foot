import { create } from 'zustand'
import { ActivityOverviewRow, NewActivityInput, activitiesRepository } from '../data/activities'
import { createLatestWins } from '../async/latestWins'

interface ActivitiesStore {
  activities: ActivityOverviewRow[]
  version: number
  loadActivities: () => Promise<void>
  publishTrailDeleted: () => Promise<void>
  saveActivity: (sessionId: number, input: NewActivityInput) => Promise<number>
  removeActivity: (id: number) => Promise<void>
}

export const useActivitiesStore = create<ActivitiesStore>((set, get) => {
  // Reloading the list after a mutation and bumping the version are one operation, so a
  // mutation cannot publish a change the selection revalidation misses. `loadActivities` on
  // its own — the focus refresh and the launch load — deliberately leaves the version alone.
  const commit = async () => {
    await get().loadActivities()
    set((s) => ({ version: s.version + 1 }))
  }
  const latestLoad = createLatestWins()

  return {
    activities: [],
    version: 0,
    loadActivities: () =>
      latestLoad(() => activitiesRepository.listOverviewRows(), (activities) => set({ activities })),
    // A trail delete clears the links to it in the same transaction, so the trails store
    // publishes that activity change here.
    publishTrailDeleted: commit,
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
