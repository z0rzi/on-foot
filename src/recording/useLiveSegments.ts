import type { TrackPoint } from '../data/activities/types'
import { selectLiveSegments } from './liveSegments'
import { useRecordingStore } from './recordingStore'

export function useLiveSegments(): TrackPoint[][] {
  return useRecordingStore(selectLiveSegments)
}
