import { Activity, ActivitySummary, LiveTrackPoint, NewActivityInput, RecordingSession, TrackPoint } from './types'

export interface ActivitiesRepository {
  startSession(startedAt: number): Promise<number>
  getActiveSession(): Promise<RecordingSession | null>
  appendPoints(sessionId: number, segment: number, points: TrackPoint[]): Promise<void>
  getSessionPoints(sessionId: number): Promise<LiveTrackPoint[]>
  markPaused(sessionId: number, pausedAt: number): Promise<void>
  markResumed(sessionId: number, pausedMs: number, currentSegment: number): Promise<void>
  markLinkedTrail(sessionId: number, linkedTrailId: number | null): Promise<void>
  discardSession(sessionId: number): Promise<void>
  saveActivity(sessionId: number, input: NewActivityInput): Promise<number>
  listSummaries(): Promise<ActivitySummary[]>
  getActivity(id: number): Promise<Activity | null>
  deleteActivity(id: number): Promise<void>
}
