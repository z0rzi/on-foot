import { RecordingSession } from '../data/activities/types'
import { movingDurationMs } from '../data/activities/duration'

export function movingElapsedMs(session: RecordingSession, now: number): number {
  return movingDurationMs(session.startedAt, session.pausedAt ?? now, session.pausedMs)
}

export function applyPause(session: RecordingSession, now: number): RecordingSession {
  return { ...session, pausedAt: now }
}

export function applyResume(session: RecordingSession, now: number): RecordingSession {
  return {
    ...session,
    pausedAt: null,
    pausedMs: session.pausedMs + (now - (session.pausedAt ?? now)),
    currentSegment: session.currentSegment + 1,
  }
}
