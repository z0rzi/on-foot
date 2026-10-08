import { formatTrailSummary } from '../format'

describe('formatTrailSummary', () => {
  test('includes gain when known', () => {
    expect(formatTrailSummary({ distanceMeters: 1500, elevationGainMeters: 340, elevationLossMeters: 300 }))
      .toBe('1.5 km · 340 m gain')
  })
  test('states when elevation is missing', () => {
    expect(formatTrailSummary({ distanceMeters: 1500, elevationGainMeters: null, elevationLossMeters: null }))
      .toBe('1.5 km · no elevation data')
  })
})
