import { interruptionMessage } from '../interruption'

describe('interruptionMessage', () => {
  it('says which span has no position, in local clock time', () => {
    const since = new Date(2026, 8, 14, 13, 56).getTime()
    const until = new Date(2026, 8, 14, 14, 40).getTime()
    expect(interruptionMessage({ since, until })).toBe('No position between 13:56 and 14:40')
  })

  it('zero-pads early hours', () => {
    const since = new Date(2026, 8, 14, 9, 5).getTime()
    const until = new Date(2026, 8, 14, 9, 7).getTime()
    expect(interruptionMessage({ since, until })).toBe('No position between 09:05 and 09:07')
  })
})
