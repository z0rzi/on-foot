import type { AppLogEntry } from './appLog'

// The capture is the recorder's file of the app's debug-log entries, one line each, as `log`
// prints them: `<time> <pid> <level> <area> <message>[ <detail JSON>]`, or `<time> <pid> (cut by
// logcat) <what came>`. A line starting with `--- ` is a gap marker, never an entry.
const CUT = '(cut by logcat) '
const GAP = '--- '
const LINE = /^(\d\d-\d\d \d\d:\d\d:\d\d\.\d+) (\d+) (.*)$/

export type CaptureItem = { kind: 'entry'; entry: AppLogEntry } | { kind: 'gap'; line: string }

export const captureLine = ({ time, pid, text }: AppLogEntry) => `${time} ${pid} ${text}`

export function parseCapture(text: string): CaptureItem[] {
  const items: CaptureItem[] = []
  for (const line of text.split('\n')) {
    if (line.startsWith(GAP)) {
      items.push({ kind: 'gap', line })
      continue
    }
    const m = LINE.exec(line)
    if (!m) continue
    const area = m[3].startsWith(CUT) ? null : (m[3].split(' ')[1] ?? null)
    items.push({ kind: 'entry', entry: { time: m[1], pid: Number(m[2]), area, text: m[3] } })
  }
  return items
}

// Where a recorder picks up a capture: logcat is started again from the time of the last entry
// written (`-T`, which includes that time), and the lines it replays up to there are dropped.
export interface ResumePoint { time: string; linesAtTime: Set<string> }

export function resumePoint(capture: string): ResumePoint | null {
  const entries = parseCapture(capture).flatMap((item) => (item.kind === 'entry' ? [item.entry] : []))
  const last = entries[entries.length - 1]
  if (!last) return null
  return { time: last.time, linesAtTime: new Set(entries.filter((e) => e.time === last.time).map(captureLine)) }
}

// The recorder's logcat, always bounded by `-T`: a fresh capture from the start of its window, one
// that holds entries from its last. A read of logcat's whole buffer scans all of it, about 30 s at
// 16 MiB, where a bounded one takes a second.
export function recorderLogcat(capture: string, windowStart: string, dump: boolean): string[] {
  const from = resumePoint(capture)?.time ?? windowStart
  return ['logcat', '-v', 'threadtime', ...(dump ? ['-d'] : []), '-T', from, '-s', 'ReactNativeJS']
}

// `-T` replays nothing older than the resume time, so only a line at that time can be one written.
export const alreadyWritten = (point: ResumePoint, entry: AppLogEntry) =>
  entry.time === point.time && point.linesAtTime.has(captureLine(entry))

const pad = (n: number, width = 2) => String(n).padStart(width, '0')

// A time of the host's clock in logcat's `MM-DD HH:MM:SS.mmm`.
const hostTime = (at: Date) =>
  `${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())}.${pad(at.getMilliseconds(), 3)}`

// Written when the recording has the phone again, or when a recorder replaces a dead one; logcat's
// buffer may have rotated past what was logged in between.
export const gapMarker = (lostAt: Date, backAt: Date) =>
  `${GAP}gap in the recording from ${hostTime(lostAt)} to ${hostTime(backAt)} (host clock): an entry older than logcat's buffer at its end is missing`

// A capture whose last line is a marker already says the recording was away, so a phone that drops
// off again before any entry adds no second one.
export function endsOnGap(capture: string): boolean {
  const last = capture.trimEnd().split('\n').pop() ?? ''
  return last.startsWith(GAP)
}

// What `log` prints from the capture: a header, then the entries oldest first with a header line
// opening each process and the gap markers in place, then the capture's path. `areas` empty keeps
// every area, and a cut entry is kept under any filter since its area is unknown. The recording
// began at its first entry, or when the capture was created while it holds none.
export function captureReport(capture: string, areas: string[], createdAt: Date, path: string): string {
  const items = parseCapture(capture)
  const entries = items.flatMap((item) => (item.kind === 'entry' ? [item.entry] : []))
  const keep = (entry: AppLogEntry) => areas.length === 0 || entry.area === null || areas.includes(entry.area)
  const kept = entries.filter(keep)
  const scope = areas.length === 0 ? '' : ` in ${areas.join(', ')}`
  const began = `the recording began at ${entries[0]?.time ?? hostTime(createdAt)}`
  const where = `capture: ${path}`
  if (entries.length === 0) return `no On Foot log entries since ${began}: the installed build may predate the mirror (\`build-has OnFootLog\`)\n${where}`
  if (kept.length === 0) return `no On Foot log entries${scope} among the ${entries.length} since ${began}\n${where}`
  const lines: string[] = []
  let pid: number | null = null
  for (const item of items) {
    if (item.kind === 'gap') {
      lines.push(item.line)
      continue
    }
    if (!keep(item.entry)) continue
    if (item.entry.pid !== pid) lines.push(`${GAP}process ${item.entry.pid}`)
    pid = item.entry.pid
    lines.push(captureLine(item.entry))
  }
  const processes = new Set(kept.map((e) => e.pid)).size
  return [`${kept.length} entries${scope}, ${processes} process${processes === 1 ? '' : 'es'}, oldest first; ${began}`, ...lines, where].join('\n')
}
