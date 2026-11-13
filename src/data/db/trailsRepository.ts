import { desc, eq } from 'drizzle-orm'
import { TrailsRepository } from '../trails/repository'
import { deserializeGeometry, inputToInsertValues, rowToOverviewRow, rowToTrail, updateToValues } from '../trails/mapping'
import { db } from './client'
import { fillOverview, listIdsWithoutOverview, overviewColumnsOf } from './overviewTable'
import { activities, recordingSessions, trails } from './schema'

const overviewRowColumns = {
  id: trails.id,
  name: trails.name,
  difficulty: trails.difficulty,
  distanceMeters: trails.distanceMeters,
  elevationGainMeters: trails.elevationGainMeters,
  elevationLossMeters: trails.elevationLossMeters,
  createdAt: trails.createdAt,
  ...overviewColumnsOf(trails),
}

export const sqliteTrailsRepository: TrailsRepository = {
  async listOverviewRows() {
    const rows = await db.select(overviewRowColumns).from(trails).orderBy(desc(trails.createdAt))
    return rows.map(rowToOverviewRow)
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
  listIdsWithoutOverview: () => listIdsWithoutOverview(trails),
  fillOverview: (id) => fillOverview(trails, id, (geometry) => deserializeGeometry(geometry).segments),
}
