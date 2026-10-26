import { useEffect } from 'react'
import { showToast } from '../components/toast'
import { logEvent } from '../log'
import { useRecordingStore } from './recordingStore'
import { interruptionMessage } from './interruption'

// Announces a pending interruption once the map is on screen: during launch the splash still covers
// it, and a toast shown then is never seen. Either may come first, the gap or the loaded map.
export function useInterruptionToast(mapLoaded: boolean): void {
  const interruption = useRecordingStore((s) => s.interruption)
  const clearInterruption = useRecordingStore((s) => s.clearInterruption)

  useEffect(() => {
    if (!mapLoaded || !interruption) return
    showToast(interruptionMessage(interruption))
    logEvent('info', 'launch', 'announced an interruption')
    clearInterruption()
  }, [mapLoaded, interruption, clearInterruption])
}
