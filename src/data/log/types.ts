export type LogLevel = 'info' | 'warn' | 'error'
export type LogArea = 'recording' | 'capture' | 'launch' | 'map' | 'error'

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
