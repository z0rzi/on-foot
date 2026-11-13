import { eq, isNull } from 'drizzle-orm'
import { storedOverview, type OverviewFill, type StartPoint } from '../geo/overview'
import { db } from './client'
import type { activities, trails } from './schema'

// A table that stores each row's overview beside its full geometry.
type OverviewTable = typeof trails | typeof activities

// The stored overview's columns, read with a row's summary.
export function overviewColumnsOf(table: OverviewTable) {
  return { overviewGeometry: table.overviewGeometry, startLat: table.startLat, startLng: table.startLng }
}

export async function listIdsWithoutOverview(table: OverviewTable): Promise<number[]> {
  const rows = await db.select({ id: table.id }).from(table).where(isNull(table.overviewGeometry))
  return rows.map((row) => row.id)
}

// Stores the overview of a row's full geometry, read into segments by `readSegments`.
export async function fillOverview(
  table: OverviewTable,
  id: number,
  readSegments: (geometry: string) => StartPoint[][],
): Promise<OverviewFill> {
  const rows = await db.select({ geometry: table.geometry }).from(table).where(eq(table.id, id)).limit(1)
  if (!rows.length) return { kind: 'missing' }
  const { columns, fill } = storedOverview(() => readSegments(rows[0].geometry))
  await db.update(table).set(columns).where(eq(table.id, id))
  return fill
}
