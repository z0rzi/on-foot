import { useMemo } from 'react'
import { groupPointsBySegment } from '../data/activities/mapping'
import { useRecordingStore } from './recordingStore'
import { personalFactor } from './personalFactor'

// The personal factor of the recording in progress: the store's history factor blended with the
// recorded track.
export function usePersonalFactor(): number {
  const history = useRecordingStore((s) => s.historyFactor)
  const livePoints = useRecordingStore((s) => s.livePoints)
  const live = useMemo(() => groupPointsBySegment(livePoints), [livePoints])
  return useMemo(() => personalFactor(history, live), [history, live])
}
