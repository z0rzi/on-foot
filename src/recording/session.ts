import { RecordingSession } from '../data/activities/types'

export function movingElapsedMs(session: RecordingSession, now: number): number {
  const end = session.pausedAt ?? session.endedAt ?? now
  return Math.max(0, end - session.startedAt - session.pausedMs)
}

export function applyPause(session: RecordingSession, now: number): RecordingSession {
  return { ...session, pausedAt: now }
}

export function applyResume(session: RecordingSession, now: number): RecordingSession {
  return {
    ...session,
    pausedAt: null,
    pausedMs: session.pausedMs + (now - (session.pausedAt ?? now)),
  }
}
