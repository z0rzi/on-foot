import { useEffect, useRef } from 'react'
import { logEvent } from '../log'
import { useMapStore } from '../store/mapStore'
import { recordingPhase } from './recordingPhase'
import { useRecordingStore } from './recordingStore'
import { AlongTrailState, alongTrailChanged, alongTrailId } from './alongTrail'

// One line per change of the recording's trail, whichever path made it: a trail shown, the Along
// row's remove, a delete, a trail that no longer loads.
export function useAlongTrailLog(): void {
  const phase = useRecordingStore((s) => recordingPhase(s.session))
  const selection = useMapStore((s) => s.selection)
  const trailId = alongTrailId(phase, selection)
  const previous = useRef<AlongTrailState>({ phase, trailId })

  useEffect(() => {
    const next = { phase, trailId }
    if (alongTrailChanged(previous.current, next)) {
      logEvent('info', 'recording', 'trail changed', { from: previous.current.trailId, to: trailId })
    }
    previous.current = next
  }, [phase, trailId])
}
