import { useEffect } from 'react'
import { AppState } from 'react-native'
import { ensureStreaming } from './recordingController'
import { recordingPhase, useRecordingStore } from './recordingStore'

function recover() {
  ensureStreaming().catch(() => {
    // A failed recovery is retried on the next return to the app, shade close or retry tap.
  })
}

// While recording, every moment location may have come back reaches recovery: returning to the app,
// the quick-settings shade closing (which pauses nothing, so only `focus` reports it), and the phase
// becoming recording. Recovery is a no-op while a stream is live.
export function useRecordingStream() {
  const phase = useRecordingStore((s) => recordingPhase(s.session))

  useEffect(() => {
    if (phase !== 'recording') return
    recover()
    const change = AppState.addEventListener('change', (state) => {
      if (state === 'active') recover()
    })
    const focus = AppState.addEventListener('focus', recover)
    return () => {
      change.remove()
      focus.remove()
    }
  }, [phase])
}
