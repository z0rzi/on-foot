import { create } from 'zustand'
import type { OfflineController, OfflinePackDescriptor, OfflinePackInfo } from '../provider/types'
import type { LiveProgress } from './types'
import { packIdsForTrail } from './operations'

interface OfflineStore {
  packs: OfflinePackInfo[]
  progress: Record<string, LiveProgress>
  init: (controller: OfflineController) => Promise<void>
  download: (controller: OfflineController, descriptor: OfflinePackDescriptor) => void
  resume: (controller: OfflineController, id: string) => void
  remove: (controller: OfflineController, ids: string[]) => Promise<void>
  removeForTrail: (controller: OfflineController, trailId: number) => Promise<void>
}

export const useOfflineStore = create<OfflineStore>((set, get) => {
  const setProgress = (id: string, percentage: number, failed: boolean) =>
    set((s) => ({ progress: { ...s.progress, [id]: { percentage, failed } } }))
  const clearProgress = (id: string) =>
    set((s) => {
      const next = { ...s.progress }
      delete next[id]
      return { progress: next }
    })
  const reload = async (controller: OfflineController) => {
    set({ packs: await controller.listPacks() })
  }
  // Own a pack's live sync: optimistic 0%, run the kickoff, then subscribe — ticks update
  // progress, completion clears it and reloads the registry, an error marks it failed.
  const track = (controller: OfflineController, id: string, kickoff: () => Promise<void>) => {
    setProgress(id, 0, false)
    kickoff()
      .then(() => {
        // `unsub` starts as a no-op because `subscribe` may invoke its callbacks
        // synchronously, before it returns the real unsubscribe function.
        let unsub = () => {}
        unsub = controller.subscribe(
          id,
          (info) => {
            setProgress(id, info.percentage, false)
            if (info.state === 'complete') {
              clearProgress(id)
              reload(controller)
              unsub()
            }
          },
          () => {
            setProgress(id, 0, true)
            unsub()
          },
        )
      })
      .catch(() => setProgress(id, 0, true))
  }

  return {
    packs: [],
    progress: {},
    init: (controller) => reload(controller),
    download: (controller, descriptor) =>
      track(controller, descriptor.id, () => controller.downloadPack(descriptor)),
    resume: (controller, id) => track(controller, id, () => controller.resumePack(id)),
    remove: async (controller, ids) => {
      await Promise.all(ids.map((id) => controller.deletePack(id)))
      ids.forEach(clearProgress)
      await reload(controller)
    },
    removeForTrail: async (controller, trailId) => {
      const ids = packIdsForTrail(await controller.listPacks(), trailId)
      await get().remove(controller, ids)
    },
  }
})
