import type { OfflineController } from '../provider/types'
import { useOfflineStore } from './offlineStore'

// Kick off a pack download or resume and wire its live progress into the session store:
// optimistic 0%, then subscribe — each tick updates progress, completion clears it and reloads
// the pack list, an error marks it failed. Shared by the layer chooser and the retry action.
export function runPackDownload(
  controller: OfflineController,
  id: string,
  kickoff: () => Promise<void>,
): void {
  useOfflineStore.getState().setProgress(id, 0, false)
  kickoff()
    .then(() => {
      const unsub = controller.subscribe(
        id,
        (info) => {
          useOfflineStore.getState().setProgress(id, info.percentage, false)
          if (info.state === 'complete') {
            useOfflineStore.getState().clearProgress(id)
            useOfflineStore.getState().refreshPacks(controller)
            unsub()
          }
        },
        () => {
          useOfflineStore.getState().setProgress(id, 0, true)
          unsub()
        },
      )
    })
    .catch(() => useOfflineStore.getState().setProgress(id, 0, true))
}
