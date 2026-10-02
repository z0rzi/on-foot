import { LogEntry } from '../../data/log'
import { LOG_EXPORT_MAX_CHARS, logExportText, logLine } from '../logExportText'

const META = {
  appVersion: '1.0.0',
  model: 'DN2103',
  androidVersion: '13',
  exportedAt: new Date(2026, 9, 2, 14, 49, 30).getTime(),
}

const entry = (id: number, t: number, over: Partial<LogEntry> = {}): LogEntry => ({
  id,
  t,
  level: 'info',
  area: 'recording',
  message: `message ${id}`,
  detail: null,
  ...over,
})

describe('logLine', () => {
  it('carries the date, the clock time, level, area and message', () => {
    const line = logLine(entry(1, new Date(2026, 9, 2, 9, 15, 0).getTime()))
    expect(line).toContain('10-02 09:15:00')
    expect(line).toContain('info')
    expect(line).toContain('recording')
    expect(line).toContain('message 1')
  })

  it('appends the detail json when there is one', () => {
    expect(logLine(entry(1, 0, { detail: '{"reason":"location-off"}' }))).toContain('{"reason":"location-off"}')
  })
})

describe('logExportText', () => {
  it('heads the text with the app version, the phone model, the android version and the export instant', () => {
    const text = logExportText([entry(1, 0)], META)
    const header = text.split('\n')[0]

    expect(header).toContain('1.0.0')
    expect(header).toContain('DN2103')
    expect(header).toContain('13')
    expect(header).toContain('Oct 2, 2026 14:49:30')
  })

  it('lists entries newest first', () => {
    const text = logExportText(
      [entry(1, 1_000), entry(2, 5_000), entry(3, 3_000)],
      META,
    )
    const body = text.split('\n').filter((l) => l.includes('message'))

    expect(body.map((l) => l.match(/message \d/)?.[0])).toEqual(['message 2', 'message 3', 'message 1'])
  })

  it('stays within the cap and says how many entries were left out', () => {
    const many = Array.from({ length: 20_000 }, (_, i) => entry(i + 1, i + 1, { message: 'x'.repeat(40) }))
    const text = logExportText(many, META)

    expect(text.length).toBeLessThanOrEqual(LOG_EXPORT_MAX_CHARS)
    expect(text).toMatch(/\d+ older entries not included/)
  })

  it('says nothing about omissions when everything fits', () => {
    expect(logExportText([entry(1, 0)], META)).not.toContain('not included')
  })

  it('reads as a header and nothing else when there is no entry', () => {
    const text = logExportText([], META)
    expect(text).toContain('1.0.0')
    expect(text).not.toContain('not included')
  })

  it('keeps a final entry that lands exactly on the cap boundary instead of reserving room for a footer it will not need', () => {
    const header = logExportText([], META)
    const overhead = logLine(entry(1, 0, { message: '' })).length
    const targetLineLength = LOG_EXPORT_MAX_CHARS - header.length - 1
    const padded = entry(1, 0, { message: 'x'.repeat(targetLineLength - overhead) })

    const text = logExportText([padded], META)

    expect(text.length).toBe(LOG_EXPORT_MAX_CHARS)
    expect(text).not.toContain('not included')
  })
})
