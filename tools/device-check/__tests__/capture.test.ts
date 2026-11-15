import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { appLogEntries } from '../appLog'
import { alreadyWritten, captureLine, captureReport, endsOnGap, gapMarker, parseCapture, recorderLogcat, resumePoint } from '../capture'

const entries = appLogEntries(readFileSync(join(__dirname, '..', 'fixtures', 'logcat-app-log.txt'), 'utf8'))

describe('the capture line', () => {
  it('holds the time, the process, the level, the area, the message and the detail', () => {
    expect(entries.map(captureLine)).toEqual([
      '11-15 09:12:01.640 21603 info launch cold start {"appVersion":"1.0.0"}',
      '11-15 09:12:02.010 21603 info map launch camera',
      `11-15 09:14:30.200 21603 (cut by logcat) ${entries[2].text.slice('(cut by logcat) '.length)}`,
      '11-15 09:15:06.120 23111 warn recording fix batch write failed {"class":"SQLiteError","near":"<position>"}',
    ])
  })

  it('reads back as the entry it was written from, a cut one and a detail with spaces included', () => {
    const spaced = { time: '11-15 09:20:00.001', pid: 4, area: 'map', text: 'info map sheet settled {"note":"a b  c"}' }
    const lines = [...entries, spaced].map(captureLine)
    expect(parseCapture(lines.join('\n') + '\n')).toEqual([...entries, spaced].map((entry) => ({ kind: 'entry', entry })))
  })

  it('keeps a gap marker in place as a line of its own', () => {
    const text = [captureLine(entries[0]), '--- gap in the recording', captureLine(entries[1])].join('\n')
    expect(parseCapture(text)).toEqual([
      { kind: 'entry', entry: entries[0] },
      { kind: 'gap', line: '--- gap in the recording' },
      { kind: 'entry', entry: entries[1] },
    ])
  })
})

const at = (time: string, text: string) => ({ time, pid: 21603, area: 'map', text })

describe('the resume point', () => {
  const written = [at('11-15 09:12:01.640', 'info map a'), at('11-15 09:12:02.010', 'info map b'), at('11-15 09:12:02.010', 'info map c')]
  const capture = [captureLine(written[0]), '--- gap in the recording', ...written.slice(1).map(captureLine)].join('\n') + '\n'

  it('is none on an empty capture, so logcat starts from its buffer', () => {
    expect(resumePoint('')).toBeNull()
    expect(resumePoint('--- gap in the recording\n')).toBeNull()
  })

  it("resumes logcat at the last line's time", () => {
    expect(resumePoint(capture)?.time).toBe('11-15 09:12:02.010')
  })

  it('takes a resumed line as written only when it is the same line at that time', () => {
    const point = resumePoint(capture)
    if (!point) throw new Error('no resume point')
    expect(alreadyWritten(point, at('11-15 09:12:02.010', 'info map c'))).toBe(true)
    expect(alreadyWritten(point, at('11-15 09:12:02.010', 'info map d'))).toBe(false)
    expect(alreadyWritten(point, at('11-15 09:12:02.011', 'info map a'))).toBe(false)
  })

  it('writes an entry of the new year after a resume point of the old one', () => {
    const point = resumePoint(`${captureLine(at('12-31 23:59:59.900', 'info map a'))}\n`)
    if (!point) throw new Error('no resume point')
    expect(alreadyWritten(point, at('01-01 00:00:00.100', 'info map b'))).toBe(false)
  })
})

describe("the recorder's logcat", () => {
  const windowStart = '11-15 09:02:00.000'

  it('reads a fresh capture from the start of its window, never the whole buffer', () => {
    expect(recorderLogcat('', windowStart, true)).toEqual(['logcat', '-v', 'threadtime', '-d', '-T', windowStart, '-s', 'ReactNativeJS'])
  })

  it('follows a capture on from its last entry', () => {
    const capture = `${captureLine(at('11-15 09:12:02.010', 'info map a'))}\n`
    expect(recorderLogcat(capture, windowStart, false)).toEqual(['logcat', '-v', 'threadtime', '-T', '11-15 09:12:02.010', '-s', 'ReactNativeJS'])
  })
})

describe('the gap marker', () => {
  it('says when the recording was lost and back, in the time format of the entries', () => {
    expect(gapMarker(new Date(2026, 10, 15, 9, 12, 1, 640), new Date(2026, 10, 15, 10, 3, 0, 5))).toBe(
      "--- gap in the recording from 11-15 09:12:01.640 to 11-15 10:03:00.005 (host clock): an entry older than logcat's buffer at its end is missing",
    )
  })

  it('ends a capture only when its last line is one', () => {
    const entry = captureLine(at('11-15 09:12:01.640', 'info map a'))
    const marker = gapMarker(new Date(2026, 10, 15, 9, 13), new Date(2026, 10, 15, 9, 14))
    expect(endsOnGap(`${entry}\n`)).toBe(false)
    expect(endsOnGap(`${entry}\n${marker}\n`)).toBe(true)
    expect(endsOnGap(`${marker}\n${entry}\n`)).toBe(false)
  })

  it('reads back as a gap, never as an entry', () => {
    const marker = gapMarker(new Date(2026, 0, 2, 3, 4, 5, 6), new Date(2026, 0, 2, 3, 5, 0, 0))
    expect(parseCapture(marker)).toEqual([{ kind: 'gap', line: marker }])
  })
})

describe("log's report", () => {
  const PATH = '/run/user/1000/on-foot-device-check/SERIAL.app-log.txt'
  const createdAt = new Date(2026, 10, 15, 9, 11, 30, 0)
  const capture = entries.map(captureLine).join('\n') + '\n'
  const cut = captureLine(entries[2])

  it('opens each process with a header line, says when the recording began, and ends on the path', () => {
    expect(captureReport(capture, [], createdAt, PATH).split('\n')).toEqual([
      '4 entries, 2 processes, oldest first; the recording began at 11-15 09:12:01.640',
      '--- process 21603',
      '11-15 09:12:01.640 21603 info launch cold start {"appVersion":"1.0.0"}',
      '11-15 09:12:02.010 21603 info map launch camera',
      cut,
      '--- process 23111',
      '11-15 09:15:06.120 23111 warn recording fix batch write failed {"class":"SQLiteError","near":"<position>"}',
      `capture: ${PATH}`,
    ])
  })

  it('keeps the areas asked for, a cut entry whose area is unknown, and a gap marker in place', () => {
    const marker = gapMarker(new Date(2026, 10, 15, 9, 14, 40), new Date(2026, 10, 15, 9, 15, 0))
    const lines = entries.map(captureLine)
    const gapped = [...lines.slice(0, 3), marker, lines[3]].join('\n')
    expect(captureReport(gapped, ['map', 'recording'], createdAt, PATH).split('\n')).toEqual([
      '3 entries in map, recording, 2 processes, oldest first; the recording began at 11-15 09:12:01.640',
      '--- process 21603',
      '11-15 09:12:02.010 21603 info map launch camera',
      cut,
      marker,
      '--- process 23111',
      '11-15 09:15:06.120 23111 warn recording fix batch write failed {"class":"SQLiteError","near":"<position>"}',
      `capture: ${PATH}`,
    ])
  })

  it('says an area has no entry among those recorded', () => {
    const uncut = entries.filter((e) => e.area !== null).map(captureLine).join('\n')
    expect(captureReport(uncut, ['capture'], createdAt, PATH)).toBe(
      `no On Foot log entries in capture among the 3 since the recording began at 11-15 09:12:01.640\ncapture: ${PATH}`,
    )
  })

  it('dates an empty recording from its start and points at the build', () => {
    expect(captureReport('', [], createdAt, PATH)).toBe(
      `no On Foot log entries since the recording began at 11-15 09:11:30.000: the installed build may predate the mirror (\`build-has OnFootLog\`)\ncapture: ${PATH}`,
    )
  })
})
