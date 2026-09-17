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
    segmentStartedAt: now,
  }
}

// After the process died while recording, capture resumes in its own segment so the saved track is
// not joined across the gap. The gap still counts as elapsed time.
export function applyRelaunch(session: RecordingSession, now: number): RecordingSession {
  return { ...session, currentSegment: session.currentSegment + 1, segmentStartedAt: now }
}
