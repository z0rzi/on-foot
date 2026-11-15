// Lines of a `logcat -v threadtime` as the toolkit reads them, and the redaction every quote of
// one goes through: no evidence carries a position.
export interface LogLine { time: string; pid: number; level: string; tag: string; message: string }

const THREADTIME = /^(\d\d-\d\d \d\d:\d\d:\d\d\.\d+)\s+(\d+)\s+\d+\s+([VDIWEF])\s+(.*?)\s*: (.*)$/

// One line of a `logcat -v threadtime`; a buffer header or a line of another format is null.
export function threadtimeLine(raw: string): LogLine | null {
  const m = THREADTIME.exec(raw.trimEnd())
  return m ? { time: m[1], pid: Number(m[2]), level: m[3], tag: m[4], message: m[5] } : null
}

const KEYED = /\b(lat|lng|lon|latitude|longitude)\b(["']?\s*[:=]\s*)-?\d+(?:\.\d+)?/gi
const PAIR = /-?\d{1,3}\.\d{2,}(?:\s*[,;]\s*|\s+)-?\d{1,3}\.\d{2,}/g

export function redactPositions(text: string): string {
  return text.replace(KEYED, '$1$2<redacted>').replace(PAIR, '<position>')
}
