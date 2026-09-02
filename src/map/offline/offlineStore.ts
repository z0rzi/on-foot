import { create } from 'zustand'
import type { OfflineController, OfflinePackDescriptor, OfflinePackInfo } from '../provider/types'
import type { LiveProgress } from './types'
import { parsePackId } from './packId'

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
              void reload(controller)
            }
          },
          () => {
            setProgress(id, 0, true)
            stopTracking(id)
          },
        )
        // Tear down any subscription a concurrent track for this id registered while our kickoff
        // was pending, so the map never overwrites a live unsub without calling it.
        stopTracking(id)
        subs.set(id, unsub)
        // Reconcile a completion that landed before the subscription attached. Best-effort: a
        // transient listPacks failure here must not mark a live download as failed — the
        // subscription is already driving it.
        try {
          await reload(controller)
          if (get().packs.some((p) => p.id === id && p.state === 'complete')) {
            clearProgress(id)
            stopTracking(id)
          }
        } catch {
          // ignore — the active subscription will still report completion
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
    // Best-effort so a cancel/remove always clears local state and never rejects — even offline,
    // where a controller call (deletePack, or listPacks via a stale pack's status) can throw. The
    // session state is torn down first; the delete + reload are attempted but not awaited-to-throw.
    remove: async (controller, ids) => {
      ids.forEach(stopTracking)
      ids.forEach(clearProgress)
      await Promise.allSettled(ids.map((id) => controller.deletePack(id)))
      try {
        await reload(controller)
      } catch {
        // ignore — packs stays as last known; the next successful reload reconciles
      }
    },
    // Ids come from in-memory state (registry packs + tracked progress), not a fresh listPacks, so a
    // pending download not yet in the registry — and an offline listPacks — can't block the cancel.
    removeForTrail: async (controller, trailId) => {
      const ids = new Set<string>()
      for (const p of get().packs) if (parsePackId(p.id)?.trailId === trailId) ids.add(p.id)
      for (const id of Object.keys(get().progress)) if (parsePackId(id)?.trailId === trailId) ids.add(id)
      await get().remove(controller, [...ids])
    },
  }
})
