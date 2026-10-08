import { formatMetricsSummary } from '../format'

describe('formatMetricsSummary', () => {
  test('includes gain when known', () => {
    expect(formatMetricsSummary({ distanceMeters: 1500, elevationGainMeters: 340, elevationLossMeters: 300 }))
      .toBe('1.5 km • 340 m gain')
  })
  test('states when elevation is missing', () => {
    expect(formatMetricsSummary({ distanceMeters: 1500, elevationGainMeters: null, elevationLossMeters: null }))
      .toBe('1.5 km • no elevation data')
  })
})
