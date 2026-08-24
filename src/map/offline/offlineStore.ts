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
  // Live subscriptions by pack id, so any path (completion, error, remove) can tear one down —
  // an orphaned subscription would keep writing progress for a pack that no longer exists.
  const subs = new Map<string, () => void>()
  const stopTracking = (id: string) => {
    const unsub = subs.get(id)
    if (unsub) {
      unsub()
      subs.delete(id)
    }
  }
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
    stopTracking(id)
    setProgress(id, 0, false)
    kickoff()
      .then(async () => {
        const unsub = controller.subscribe(
          id,
          (info) => {
            setProgress(id, info.percentage, false)
            if (info.state === 'complete') {
              clearProgress(id)
              stopTracking(id)
              reload(controller)
            }
          },
          () => {
            setProgress(id, 0, true)
            stopTracking(id)
          },
        )
        subs.set(id, unsub)
        // Reconcile a completion that landed before the subscription attached.
        await reload(controller)
        if (get().packs.some((p) => p.id === id && p.state === 'complete')) {
          clearProgress(id)
          stopTracking(id)
        }
      })
      .catch(() => {
        setProgress(id, 0, true)
        stopTracking(id)
      })
  }

  return {
    packs: [],
    progress: {},
    init: (controller) => reload(controller),
    download: (controller, descriptor) =>
      track(controller, descriptor.id, () => controller.downloadPack(descriptor)),
    resume: (controller, id) => track(controller, id, () => controller.resumePack(id)),
    remove: async (controller, ids) => {
      ids.forEach(stopTracking)
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
