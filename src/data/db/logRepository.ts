import { desc, lt, notInArray } from 'drizzle-orm'
import { LogRepository } from '../log/repository'
import { rowToEntry } from '../log/mapping'
import { db } from './client'
import { debugLog } from './schema'

export const sqliteLogRepository: LogRepository = {
  async append(entry) {
    await db.insert(debugLog).values(entry)
  },
  async list(limit) {
    const rows = await db
      .select()
      .from(debugLog)
      .orderBy(desc(debugLog.t), desc(debugLog.id))
      .limit(limit)
    return rows.map(rowToEntry)
  },
  async trim(cutoff, maxEntries) {
    await db.delete(debugLog).where(lt(debugLog.t, cutoff))
    const keep = db
      .select({ id: debugLog.id })
      .from(debugLog)
      .orderBy(desc(debugLog.t), desc(debugLog.id))
      .limit(maxEntries)
    await db.delete(debugLog).where(notInArray(debugLog.id, keep))
  },
  async clear() {
    await db.delete(debugLog)
  },
}
