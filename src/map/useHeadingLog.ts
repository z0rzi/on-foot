import { useEffect } from 'react'
import { watchHeading } from '../location'
import { logEvent } from '../log'
import { useAppActive } from '../recording/appActivity'
import { recordingPhase } from '../recording/recordingPhase'
import { useRecordingStore } from '../recording/recordingStore'
import {
  HEADING_CHECK_EVERY_MS,
  headingReading,
  headingTick,
  metresMovedSince,
  startHeadingMonitor,
} from './headingMonitor'

// T-89: the puck's heading arrow is drawn by the map SDK from a compass this app never sees. A
// second watch on the same compass, held while a recording is live and the app is in front, says
// whether the phone was still turning when the arrow froze. Each start has its own monitor, so
// nothing is reported across a stop. It only logs: a watch that cannot start says so once.
export function useHeadingLog(): void {
  const recording = useRecordingStore((s) => recordingPhase(s.session) === 'recording')
  const watching = useAppActive() && recording

  useEffect(() => {
    if (!watching) return
    let monitor = startHeadingMonitor(Date.now())
    let stop: (() => void) | null = null
    let ended = false

    const take = (step: ReturnType<typeof headingTick>) => {
      monitor = step.monitor
      for (const entry of step.entries) logEvent(entry.level, 'map', entry.message, entry.detail)
    }

    const timer = setInterval(() => {
      const points = useRecordingStore.getState().livePoints
      take(headingTick(monitor, Date.now(), (since) => metresMovedSince(points, since)))
    }, HEADING_CHECK_EVERY_MS)

    watchHeading((reading) => take(headingReading(monitor, { t: Date.now(), ...reading }))).then(
      (remove) => {
        if (ended) return remove()
        stop = remove
        logEvent('info', 'map', 'heading watch', { on: true })
      },
      (error: unknown) => {
        if (ended) return
        clearInterval(timer)
        logEvent('warn', 'map', 'heading watch', {
          on: false,
          error: error instanceof Error ? error.message : String(error),
        })
      },
    )

    return () => {
      ended = true
      clearInterval(timer)
      if (!stop) return
      stop()
      logEvent('info', 'map', 'heading watch', { on: false })
    }
  }, [watching])
}
