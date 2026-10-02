import { LogEntry, NewLogEntry } from './types'

export interface LogRepository {
  append(entry: NewLogEntry): Promise<void>
  list(limit: number): Promise<LogEntry[]>
  trim(cutoff: number, maxEntries: number): Promise<void>
  clear(): Promise<void>
}
