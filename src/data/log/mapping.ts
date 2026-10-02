import { LogArea, LogEntry, LogLevel } from './types'

// A log that breaks the app would be worse than no log, so an unserialisable detail is dropped.
export function encodeDetail(detail: Record<string, unknown> | undefined): string | null {
  if (detail === undefined) return null
  try {
    return JSON.stringify(detail) ?? null
  } catch {
    return null
  }
}

export function rowToEntry(row: {
  id: number
  t: number
  level: string
  area: string
  message: string
  detail: string | null
}): LogEntry {
  return {
    id: row.id,
    t: row.t,
    // This app is the only writer of these columns, the same way rowToSession and
    // rowToActivity read their enum columns; a retired level/area name would widen, not break.
    level: row.level as LogLevel,
    area: row.area as LogArea,
    message: row.message,
    detail: row.detail,
  }
}
