import { recordingFigures } from '../recordingFigures'

describe('recordingFigures', () => {
  const walked = { movingSeconds: 4325, distanceMeters: 6_420, gainMeters: 412 }
  // 1 000 m in 760 s: 12:40 /km, 4.7 km/h.
  const pace = { distanceMeters: 1000, movingSeconds: 760 }

  test('time, distance, pace and gain, each with its label', () => {
    expect(recordingFigures({ ...walked, pace, paceSpeedMode: 'pace' })).toEqual([
      { value: '1:12:05', label: 'time' },
      { value: '6.4 km', label: 'distance' },
      { value: '12:40', label: '/km' },
      { value: '412 m', label: 'gain' },
    ])
  })

  test('speed mode shows the same window as km/h', () => {
    expect(recordingFigures({ ...walked, pace, paceSpeedMode: 'speed' })[2]).toEqual({ value: '4.7', label: 'km/h' })
  })

  test('no pace window yet: a dash, in either mode', () => {
    expect(recordingFigures({ ...walked, pace: null, paceSpeedMode: 'pace' })[2]).toEqual({ value: '—', label: '/km' })
    expect(recordingFigures({ ...walked, pace: null, paceSpeedMode: 'speed' })[2]).toEqual({ value: '—', label: 'km/h' })
  })

  test('no elevation yet: a dash for the gain', () => {
    expect(recordingFigures({ ...walked, gainMeters: null, pace, paceSpeedMode: 'pace' })[3]).toEqual({ value: '—', label: 'gain' })
  })
})
