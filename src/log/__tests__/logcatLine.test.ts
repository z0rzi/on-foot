import { logcatLine } from '../logcatLine'

const LOGCAT_MARK = 'OnFootLog'

const entry = { t: 1_700_000_000_000, level: 'info' as const, area: 'map' as const, message: 'heading watch', detail: '{"on":false}' }

const payload = (line: string) => JSON.parse(line.slice(`${LOGCAT_MARK} `.length))

describe('logcatLine', () => {
  it('starts with the mark and holds the entry as JSON, its detail as the object it encodes', () => {
    const line = logcatLine(entry)
    expect(line.startsWith(`${LOGCAT_MARK} {`)).toBe(true)
    expect(payload(line)).toEqual({ t: 1_700_000_000_000, level: 'info', area: 'map', message: 'heading watch', detail: { on: false } })
  })

  it('writes a missing detail as null', () => {
    expect(payload(logcatLine({ ...entry, detail: null })).detail).toBeNull()
  })

  it('keeps quotes and newlines of a message inside its string', () => {
    const message = 'route "Col"\nfailed'
    expect(payload(logcatLine({ ...entry, message })).message).toBe(message)
  })

  it('is one line', () => {
    expect(logcatLine({ ...entry, message: 'a\nb', detail: '{"stack":"x\\ny"}' })).not.toContain('\n')
  })
})
