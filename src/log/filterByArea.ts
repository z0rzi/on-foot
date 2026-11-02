import { LogArea, LogEntry } from '../data/log/types'

export function filterByArea(entries: LogEntry[], enabledAreas: ReadonlySet<LogArea>): LogEntry[] {
  return entries.filter((entry) => enabledAreas.has(entry.area))
}
