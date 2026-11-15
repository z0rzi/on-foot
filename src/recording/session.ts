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

// After a real gap in a recording whose process died, capture resumes in its own segment so the saved
// track is not joined across the gap. The segment starts just after the session was last known
// recording, not at the relaunch: fixes the dead time delivers late belong to it, a cached position
// from before the last stored point does not. The gap still counts as elapsed time.
export function applyRelaunch(session: RecordingSession, lastKnownRecordingAt: number): RecordingSession {
  return { ...session, currentSegment: session.currentSegment + 1, segmentStartedAt: lastKnownRecordingAt + 1 }
}

// A fix taken before its segment began is not part of it: the location service can hand back a cached
// position — such as where the recording paused — as the first fix after capture restarts.
export function fixesInSegment<T extends { t: number }>(fixes: T[], segmentStartedAt: number): T[] {
  return fixes.filter((fix) => fix.t >= segmentStartedAt)
}
