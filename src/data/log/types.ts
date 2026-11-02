export type LogLevel = 'info' | 'warn' | 'error'
export const LOG_AREAS = ['recording', 'capture', 'launch', 'map', 'error'] as const
export type LogArea = (typeof LOG_AREAS)[number]

export interface LogEntry {
  id: number
  t: number
  level: LogLevel
  area: LogArea
  message: string
  detail: string | null
}

export interface NewLogEntry {
  t: number
  level: LogLevel
  area: LogArea
  message: string
  detail: string | null
}
