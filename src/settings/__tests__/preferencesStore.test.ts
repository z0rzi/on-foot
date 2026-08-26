import { nextPaceSpeedMode } from '../preferencesStore'

describe('nextPaceSpeedMode', () => {
  it('flips pace to speed and back', () => {
    expect(nextPaceSpeedMode('pace')).toBe('speed')
    expect(nextPaceSpeedMode('speed')).toBe('pace')
  })
})
