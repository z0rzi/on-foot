import { useEffect, useState } from 'react'
import { RecordingSession } from '../data/activities/types'
import { recordingPhase } from './recordingStore'
import { movingElapsedMs } from './session'

// Live moving-elapsed time (ms) for a recording session: advances each second while recording,
// frozen while paused. Time is held in reactive state (never read from Date.now() inside a render
// derivation, which the React Compiler would memoize away) so consumers recompute on every tick,
// and it is refreshed synchronously on the transition into recording so the first frame after a
// resume already reflects the accumulated pause instead of the pre-resume value.
export function useMovingStopwatch(session: RecordingSession | null): number {
  const phase = recordingPhase(session)
  const [now, setNow] = useState(() => Date.now())
  const [prevPhase, setPrevPhase] = useState(phase)
  if (phase !== prevPhase) {
    setPrevPhase(phase)
    if (phase === 'recording') setNow(Date.now())
  }
  useEffect(() => {
    if (phase !== 'recording') return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [phase])
  return session ? movingElapsedMs(session, now) : 0
}
