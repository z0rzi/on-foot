import { desc, eq } from 'drizzle-orm'
import { TrailsRepository } from '../trails/repository'
import { inputToInsertValues, rowToSummary, rowToTrail, updateToValues } from '../trails/mapping'
import { db } from './client'
import { activities, recordingSessions, trails } from './schema'

export const sqliteTrailsRepository: TrailsRepository = {
  async listSummaries() {
    const rows = await db.select().from(trails).orderBy(desc(trails.createdAt))
    return rows.map(rowToSummary)
  },
  async getTrail(id) {
    const rows = await db.select().from(trails).where(eq(trails.id, id)).limit(1)
    return rows.length ? rowToTrail(rows[0]) : null
  },
  async createTrail(input) {
    const [inserted] = await db
      .insert(trails)
      .values(inputToInsertValues(input, Date.now()))
      .returning({ id: trails.id })
    return inserted.id
  },
  async updateTrail(id, update) {
    await db.update(trails).set(updateToValues(update, Date.now())).where(eq(trails.id, id))
  },
  async deleteTrail(id) {
    await db.transaction((tx) => {
      tx.update(activities).set({ linkedTrailId: null }).where(eq(activities.linkedTrailId, id)).run()
      tx.update(recordingSessions).set({ linkedTrailId: null }).where(eq(recordingSessions.linkedTrailId, id)).run()
      tx.delete(trails).where(eq(trails.id, id)).run()
    })
  },
}
