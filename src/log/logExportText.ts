import { LogEntry } from '../data/log'
import { formatActivityDate, formatCalendarClockSeconds, formatClockSeconds } from '../activities/format'

export const LOG_EXPORT_MAX_CHARS = 200_000

export interface LogDeviceInfo {
  appVersion: string
  model: string
  androidVersion: string
}

export interface LogExportMeta extends LogDeviceInfo {
  exportedAt: number
}

export function logLine(entry: LogEntry): string {
  const head = `${formatCalendarClockSeconds(entry.t)} ${entry.level} ${entry.area} ${entry.message}`
  return entry.detail ? `${head} ${entry.detail}` : head
}

function omittedFooter(omitted: number): string {
  return omitted > 0 ? `\n… ${omitted} older entries not included` : ''
}

// A share intent over the system's limit fails silently, so the text is capped and says what it left
// out rather than arriving truncated mid-line. A candidate line is measured against the footer that
// would follow it if it were the last one kept, not the footer for leaving it out — otherwise a line
// landing exactly on the boundary gets rejected to make room for a footer it turns out not to need.
export function logExportText(entries: LogEntry[], meta: LogExportMeta): string {
  const exported = `${formatActivityDate(meta.exportedAt)} ${formatClockSeconds(meta.exportedAt)}`
  // A log spans several days, so every line carries its date and the header says when it was taken:
  // a shared export is datable without asking the reporter when they tapped Share.
  const header = `On Foot ${meta.appVersion} · ${meta.model} · Android ${meta.androidVersion} · exported ${exported}`
  const newestFirst = [...entries].sort((a, b) => b.t - a.t || b.id - a.id)

  const lines: string[] = []
  let length = header.length
  let included = 0
  for (const entry of newestFirst) {
    const line = logLine(entry)
    const footer = omittedFooter(newestFirst.length - included - 1)
    if (length + 1 + line.length + footer.length > LOG_EXPORT_MAX_CHARS) break
    lines.push(line)
    length += 1 + line.length
    included += 1
  }

  const body = [header, ...lines].join('\n')
  return `${body}${omittedFooter(newestFirst.length - included)}`
}
