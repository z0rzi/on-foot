import { OverviewFill } from '../geo/overview'
import { Activity, ActivityOverviewRow, LiveTrackPoint, NewActivityInput, RecordingSession, TrackPoint } from './types'

export interface ActivitiesRepository {
  startSession(startedAt: number): Promise<number>
  getActiveSession(): Promise<RecordingSession | null>
  appendPoints(sessionId: number, segment: number, points: TrackPoint[]): Promise<void>
  getSessionPoints(sessionId: number): Promise<LiveTrackPoint[]>
  getLastSegmentPoint(sessionId: number, segment: number): Promise<TrackPoint | null>
  markPaused(sessionId: number, pausedAt: number): Promise<void>
  markResumed(sessionId: number, pausedMs: number, currentSegment: number, segmentStartedAt: number): Promise<void>
  markLinkedTrail(sessionId: number, linkedTrailId: number | null): Promise<void>
  discardSession(sessionId: number): Promise<void>
  saveActivity(sessionId: number, input: NewActivityInput): Promise<number>
  listOverviewRows(): Promise<ActivityOverviewRow[]>
  getActivity(id: number): Promise<Activity | null>
  deleteActivity(id: number): Promise<void>
  // The rows saved before overviews existed, for the backfill.
  listIdsWithoutOverview(): Promise<number[]>
  fillOverview(id: number): Promise<OverviewFill>
}
