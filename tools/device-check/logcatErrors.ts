// The native errors in a `logcat -v threadtime` of On Foot's process, ready to quote: positions
// are redacted, as no evidence carries one.
export type NativeErrorKind = 'mapbox' | 'js' | 'fatal'

export interface NativeError { kind: NativeErrorKind; line: string }

interface LogLine { time: string; level: string; tag: string; message: string }

const THREADTIME = /^(\d\d-\d\d \d\d:\d\d:\d\d\.\d+)\s+\d+\s+\d+\s+([VDIWEF])\s+(.*?)\s*: (.*)$/

const KEYED = /\b(lat|lng|lon|latitude|longitude)\b(["']?\s*[:=]\s*)-?\d+(?:\.\d+)?/gi
const PAIR = /-?\d{1,3}\.\d{2,}(?:\s*[,;]\s*|\s+)-?\d{1,3}\.\d{2,}/g

export function redactPositions(text: string): string {
  return text.replace(KEYED, '$1$2<redacted>').replace(PAIR, '<position>')
}

const atLeast = (level: string, floor: 'W' | 'E') => (floor === 'W' ? /[WEF]/ : /[EF]/).test(level)

// Mapbox warns of a source or layer the style cannot bind; anything else it warns of (a style
// config, a tile request) is not a style error. The rnmapbox wrapper logs under RNMBX tags.
function kindOf({ level, tag, message }: LogLine): NativeErrorKind | null {
  if (tag === 'Mapbox' && atLeast(level, 'W') && /\b(source|layer)s?\b|sourceId|layerId/i.test(message)) return 'mapbox'
  if (tag.startsWith('RNMBX') && atLeast(level, 'E')) return 'mapbox'
  if (tag === 'ReactNativeJS' && atLeast(level, 'E')) return 'js'
  if (tag === 'AndroidRuntime' && atLeast(level, 'E')) return 'fatal'
  return null
}

export function nativeErrors(logcat: string): NativeError[] {
  const found: NativeError[] = []
  for (const raw of logcat.split('\n')) {
    const m = THREADTIME.exec(raw.trimEnd())
    if (!m) continue
    const line: LogLine = { time: m[1], level: m[2], tag: m[3], message: m[4] }
    const kind = kindOf(line)
    if (kind) found.push({ kind, line: `${line.time} ${line.level} ${line.tag}: ${redactPositions(line.message)}` })
  }
  return found
}
