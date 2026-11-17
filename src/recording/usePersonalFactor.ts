import { useMemo } from 'react'
import { useRecordingStore } from './recordingStore'
import { personalFactor } from './personalFactor'
import { useLiveSegments } from './useLiveSegments'

// The personal factor of the recording in progress: the store's history factor blended with the
// recorded track.
export function usePersonalFactor(): number {
  const history = useRecordingStore((s) => s.historyFactor)
  const live = useLiveSegments()
  return useMemo(() => personalFactor(history, live), [history, live])
}
