import { useRecordingStore } from './recordingStore'

type State = ReturnType<typeof useRecordingStore.getState>

// Until launch has settled, a null session only means the durable one has not been read yet.
const noSession = (state: State): boolean => state.resumeSettled && state.session === null

// Runs `run` once no recording session exists: now, or when the session ends. Returns the cancel.
export function whenNoRecordingSession(run: () => void): () => void {
  if (noSession(useRecordingStore.getState())) {
    run()
    return () => {}
  }
  const unsubscribe = useRecordingStore.subscribe((state) => {
    if (!noSession(state)) return
    unsubscribe()
    run()
  })
  return unsubscribe
}
