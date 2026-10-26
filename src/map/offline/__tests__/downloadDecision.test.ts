import { downloadDecision } from '../downloadDecision'

const MiB = 1024 * 1024

describe('downloadDecision', () => {
  test('offline is refused before the disk is considered', () => {
    expect(downloadDecision('offline', 0, 50 * MiB)).toEqual({ kind: 'offline' })
  })

  test('not enough space is refused before mobile data is asked about', () => {
    expect(downloadDecision('metered', 120 * MiB, 50 * MiB)).toEqual({
      kind: 'no-space',
      neededBytes: 150 * MiB,
      freeBytes: 120 * MiB,
    })
  })

  test('mobile data with room to spare asks first', () => {
    expect(downloadDecision('metered', 500 * MiB, 50 * MiB)).toEqual({ kind: 'ask-metered' })
  })

  test('an unmetered connection with room to spare proceeds', () => {
    expect(downloadDecision('ok', 500 * MiB, 50 * MiB)).toEqual({ kind: 'proceed' })
  })

  test('unknown free space fails open past the disk check', () => {
    expect(downloadDecision('ok', null, 50 * MiB)).toEqual({ kind: 'proceed' })
    expect(downloadDecision('metered', null, 50 * MiB)).toEqual({ kind: 'ask-metered' })
  })

  test('an unknown estimate fails open past the disk check', () => {
    expect(downloadDecision('ok', 0, null)).toEqual({ kind: 'proceed' })
    expect(downloadDecision('metered', 0, null)).toEqual({ kind: 'ask-metered' })
  })
})
