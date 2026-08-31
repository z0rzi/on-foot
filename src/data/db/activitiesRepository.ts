import { asc, desc, eq } from 'drizzle-orm'
import { ActivitiesRepository } from '../activities/repository'
import {
  ActivityRow, RecordingPointRow, RecordingSessionRow,
  groupPointsBySegment, inputToActivityValues, pointsToInsertValues,
  rowToActivity, rowToSession, rowToSummary,
} from '../activities/mapping'
import { db } from './client'
import { activities, recordingPoints, recordingSessions } from './schema'

export const sqliteActivitiesRepository: ActivitiesRepository = {
  async startSession(startedAt) {
    const [inserted] = await db
      .insert(recordingSessions)
      .values({ startedAt })
      .returning({ id: recordingSessions.id })
    return inserted.id
  },
  async getActiveSession() {
    // The singleton unique index caps this table at one row, so a single unordered read is it.
    const rows = await db.select().from(recordingSessions).limit(1)
    return rows.length ? rowToSession(rows[0] as RecordingSessionRow) : null
  },
  async appendPoints(sessionId, segment, points) {
    if (points.length === 0) return
    await db.insert(recordingPoints).values(pointsToInsertValues(sessionId, segment, points))
  },
  async getSessionSegments(sessionId) {
    const rows = await db
      .select()
      .from(recordingPoints)
      .where(eq(recordingPoints.sessionId, sessionId))
      .orderBy(asc(recordingPoints.segment), asc(recordingPoints.t), asc(recordingPoints.id))
    return groupPointsBySegment(rows as RecordingPointRow[])
  },
  async markPaused(sessionId, pausedAt) {
    await db.update(recordingSessions).set({ pausedAt }).where(eq(recordingSessions.id, sessionId))
  },
  async markResumed(sessionId, pausedMs, currentSegment) {
    await db.update(recordingSessions)
      .set({ pausedAt: null, pausedMs, currentSegment })
      .where(eq(recordingSessions.id, sessionId))
  },
  async markLinkedTrail(sessionId, linkedTrailId) {
    await db.update(recordingSessions).set({ linkedTrailId }).where(eq(recordingSessions.id, sessionId))
  },
  async discardSession(sessionId) {
    await db.transaction((tx) => {
      tx.delete(recordingPoints).where(eq(recordingPoints.sessionId, sessionId)).run()
      tx.delete(recordingSessions).where(eq(recordingSessions.id, sessionId)).run()
    })
  },
  async saveActivity(sessionId, input) {
    return db.transaction((tx) => {
      const [inserted] = tx
        .insert(activities)
        .values(inputToActivityValues(input, Date.now()))
        .returning({ id: activities.id })
        .all()
      tx.delete(recordingPoints).where(eq(recordingPoints.sessionId, sessionId)).run()
      tx.delete(recordingSessions).where(eq(recordingSessions.id, sessionId)).run()
      return inserted.id
    })
  },
  async listSummaries() {
    const rows = await db.select().from(activities).orderBy(desc(activities.startedAt))
    return (rows as ActivityRow[]).map(rowToSummary)
  },
  async getActivity(id) {
    const rows = await db.select().from(activities).where(eq(activities.id, id)).limit(1)
    return rows.length ? rowToActivity(rows[0] as ActivityRow) : null
  },
  async deleteActivity(id) {
    await db.delete(activities).where(eq(activities.id, id))
  },
}
