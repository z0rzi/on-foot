import { recordingBannerText } from '../recordingBanner'

describe('recordingBannerText', () => {
  it('idle: no banner', () => {
    expect(recordingBannerText('idle', 120)).toBeNull()
  })
  it('recording: dot, word and ticking time', () => {
    expect(recordingBannerText('recording', 4325)).toBe('● Recording · 1:12:05')
  })
  it('paused: pause sign and the frozen time', () => {
    expect(recordingBannerText('paused', 4325)).toBe('⏸ Paused · 1:12:05')
  })
  it('under an hour: m:ss', () => {
    expect(recordingBannerText('recording', 65)).toBe('● Recording · 1:05')
  })
})
