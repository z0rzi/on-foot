export const LOG_RETENTION_DAYS = 7
export const LOG_MAX_ENTRIES = 5000

const DAY_MS = 24 * 60 * 60 * 1000

export function retentionCutoff(now: number): number {
  return now - LOG_RETENTION_DAYS * DAY_MS
}
