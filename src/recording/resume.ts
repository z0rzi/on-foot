import { RecordingSession, TrackPoint } from '../data/activities/types'

// `continue` keeps the current segment; `resume` cuts, opening a new one after the gap.
export type ResumeAction = 'none' | 'resume' | 'continue' | 'paused'

// A walker rarely goes this long between fixes, so a relaunch this soon after the session was last
// known recording has missed nothing worth a new segment.
const RELAUNCH_CONTINUE_MS = 30_000

// The last moment the session is known to have been recording: its last stored point, or the start
// of its current segment when that is later.
export function lastKnownRecordingAt(session: RecordingSession, lastPoint: TrackPoint | null): number {
  return Math.max(session.segmentStartedAt, lastPoint?.t ?? session.segmentStartedAt)
}

export function resumeActionFor(
  session: RecordingSession | null,
  lastPoint: TrackPoint | null,
  now: number,
): ResumeAction {
  if (!session) return 'none'
  if (session.pausedAt != null) return 'paused'
  return now - lastKnownRecordingAt(session, lastPoint) <= RELAUNCH_CONTINUE_MS ? 'continue' : 'resume'
}
