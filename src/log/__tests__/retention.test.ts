import { LOG_MAX_ENTRIES, LOG_RETENTION_DAYS, retentionCutoff } from '../retention'

describe('retentionCutoff', () => {
  it('is seven days before the given instant', () => {
    const now = Date.parse('2026-10-02T12:00:00.000Z')
    expect(retentionCutoff(now)).toBe(Date.parse('2026-09-25T12:00:00.000Z'))
  })

  it('keeps the documented limits', () => {
    expect(LOG_RETENTION_DAYS).toBe(7)
    expect(LOG_MAX_ENTRIES).toBe(5000)
  })
})
