import { redactPositions, threadtimeLine } from './logcat'

// The app mirrors every debug-log entry to logcat as `OnFootLog {json}` under `ReactNativeJS`
// (`src/log/logcatLine.ts`); the cross-check test holds this reader to that writer.
const MARK = 'OnFootLog '

export interface AppLogEntry { time: string; pid: number; area: string | null; text: string }

interface Payload { level: string; area: string; message: string; detail: unknown }

function payload(json: string): Payload | null {
  try {
    const value: unknown = JSON.parse(json)
    if (typeof value !== 'object' || value === null) return null
    const { level, area, message, detail } = value as Record<string, unknown>
    return typeof level === 'string' && typeof area === 'string' && typeof message === 'string' ? { level, area, message, detail } : null
  } catch {
    return null
  }
}

// The app's entries in a `logcat -v threadtime`, oldest first. Logcat cuts an entry past about 4 KB,
// so a line that does not parse is kept as it came, with no area.
export function appLogEntries(logcat: string): AppLogEntry[] {
  const entries: AppLogEntry[] = []
  for (const raw of logcat.split('\n')) {
    const line = threadtimeLine(raw)
    if (!line || line.tag !== 'ReactNativeJS' || !line.message.startsWith(MARK)) continue
    const json = line.message.slice(MARK.length)
    const entry = payload(json)
    const text = entry
      ? [entry.level, entry.area, entry.message, ...(entry.detail === null || entry.detail === undefined ? [] : [JSON.stringify(entry.detail)])].join(' ')
      : `(cut by logcat) ${json}`
    entries.push({ time: line.time, pid: line.pid, area: entry?.area ?? null, text: redactPositions(text) })
  }
  return entries
}
