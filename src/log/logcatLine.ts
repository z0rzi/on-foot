import type { NewLogEntry } from '../data/log'

const LOGCAT_MARK = 'OnFootLog'

// One entry as one logcat line, the mark then a JSON object; `detail` is already JSON and goes in
// as the value it encodes.
export function logcatLine(entry: NewLogEntry): string {
  const { t, level, area, message, detail } = entry
  return `${LOGCAT_MARK} {"t":${t},"level":${JSON.stringify(level)},"area":${JSON.stringify(area)},"message":${JSON.stringify(message)},"detail":${detail ?? 'null'}}`
}
