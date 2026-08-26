import { evaluateDownloadGate } from '../gate'

describe('evaluateDownloadGate', () => {
  test('offline status gates as offline (even on cellular)', () => {
    expect(evaluateDownloadGate({ online: false, metered: true })).toBe('offline')
    expect(evaluateDownloadGate({ online: false, metered: false })).toBe('offline')
  })
  test('online and metered warns', () => {
    expect(evaluateDownloadGate({ online: true, metered: true })).toBe('metered')
  })
  test('online and unmetered is ok', () => {
    expect(evaluateDownloadGate({ online: true, metered: false })).toBe('ok')
  })
})
