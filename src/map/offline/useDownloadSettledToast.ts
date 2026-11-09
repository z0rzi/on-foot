import { useEffect } from 'react'
import { showToast } from '../../components/toast'
import { logEvent } from '../../log'
import { useOfflineStore } from './offlineStore'

// One toast per trail whose offline map download has settled, wherever the user is in the app.
export function useDownloadSettledToast(): void {
  const settled = useOfflineStore((s) => s.settled)
  const dismissSettled = useOfflineStore((s) => s.dismissSettled)

  useEffect(() => {
    if (settled.length === 0) return
    for (const { failed } of settled) {
      showToast(failed ? 'Offline map failed' : 'Offline map ready')
      logEvent(failed ? 'warn' : 'info', 'map', failed ? 'offline download failed' : 'offline download complete')
    }
    dismissSettled(settled)
  }, [settled, dismissSettled])
}
