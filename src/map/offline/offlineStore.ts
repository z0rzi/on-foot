import { create } from 'zustand'
import { errorClass, logEvent } from '../../log'
import type { OfflineController, OfflinePackDescriptor, OfflinePackInfo } from '../provider/types'
import type { LiveProgress } from './types'
import { livePacks, packsForTrail } from './packId'
import { createDownloadBatches, type DownloadSettled } from './downloadBatches'

interface OfflineStore {
  packs: OfflinePackInfo[]
  progress: Record<string, LiveProgress>
  // Trails whose download has settled, oldest first, until a listener dismisses them.
  settled: DownloadSettled[]
  dismissSettled: (events: DownloadSettled[]) => void
  reload: (controller: OfflineController) => Promise<void>
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
  const batches = createDownloadBatches()
  const publish = (event: DownloadSettled | null) => {
    if (event) set((s) => ({ settled: [...s.settled, event] }))
  }
  const reload = async (controller: OfflineController) => {
    set({ packs: await controller.listPacks() })
  }
  // Own a pack's live sync: optimistic 0%, run the kickoff, then subscribe — ticks update
  // progress, completion clears it and reloads the registry, an error marks it failed.
  const track = (controller: OfflineController, id: string, kickoff: () => Promise<void>) => {
    stopTracking(id)
    setProgress(id, 0, false)
    batches.start(id)
    kickoff()
      .then(async () => {
        const unsub = controller.subscribe(
          id,
          (info) => {
            setProgress(id, info.percentage, false)
            if (info.state === 'complete') {
              clearProgress(id)
              stopTracking(id)
              publish(batches.settle(id, false))
              void reload(controller)
            }
          },
          // The port's failure is the SDK's message alone: no class to log, and the message stays out.
          () => {
            logEvent('warn', 'error', 'download failed', { stage: 'progress' })
            setProgress(id, 0, true)
            stopTracking(id)
            publish(batches.settle(id, true))
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
            publish(batches.settle(id, false))
          }
        } catch {
          // ignore — the active subscription will still report completion
        }
      })
      .catch((error: unknown) => {
        logEvent('warn', 'error', 'download failed', { stage: 'start', errorClass: errorClass(error) })
        setProgress(id, 0, true)
        stopTracking(id)
        publish(batches.settle(id, true))
      })
  }

  return {
    packs: [],
    progress: {},
    settled: [],
    dismissSettled: (events) => set((s) => ({ settled: s.settled.filter((e) => !events.includes(e)) })),
    reload,
    download: (controller, descriptor) =>
      track(controller, descriptor.id, () => controller.downloadPack(descriptor)),
    resume: (controller, id) => track(controller, id, () => controller.resumePack(id)),
    // Best-effort so a cancel/remove always clears local state and never rejects — even offline,
    // where a controller call (deletePack, or listPacks via a stale pack's status) can throw. The
    // session state is torn down first; the delete + reload are attempted but not awaited-to-throw.
    remove: async (controller, ids) => {
      ids.forEach(stopTracking)
      ids.forEach(clearProgress)
      ids.forEach(batches.drop)
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
      const { packs, progress } = get()
      const ids = new Set(
        [...packsForTrail(packs, trailId), ...packsForTrail(livePacks(progress), trailId)].map(({ pack }) => pack.id),
      )
      await get().remove(controller, [...ids])
    },
  }
})
