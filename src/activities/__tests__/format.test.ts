import { formatDuration, formatActivityDate, formatActivitySummary } from '../format'
import { ActivityMetrics } from '../../data/activities/types'

describe('formatDuration', () => {
  it('formats seconds under a minute', () => {
    expect(formatDuration(45)).toBe('45s')
  })
  it('formats whole minutes', () => {
    expect(formatDuration(600)).toBe('10m')
  })
  it('formats minutes + seconds', () => {
    expect(formatDuration(125)).toBe('2m 5s')
  })
  it('formats hours + minutes', () => {
    expect(formatDuration(3720)).toBe('1h 2m')
  })
  it('clamps negatives to 0s', () => {
    expect(formatDuration(-5)).toBe('0s')
  })
})

describe('formatActivityDate', () => {
  test('formats a timestamp as "Mon D, YYYY" in local time', () => {
    // Construct with local components so the assertion is timezone-independent.
    const ts = new Date(2026, 7, 22, 10, 30).getTime() // Aug = month index 7
    expect(formatActivityDate(ts)).toBe('Aug 22, 2026')
  })
  test('formats a single-digit day without padding', () => {
    const ts = new Date(2026, 0, 5, 9, 0).getTime() // Jan 5
    expect(formatActivityDate(ts)).toBe('Jan 5, 2026')
  })
})

describe('formatActivitySummary', () => {
  const metrics = (distanceMeters: number, durationSeconds: number): ActivityMetrics => ({
    distanceMeters, durationSeconds, elevationGainMeters: null, elevationLossMeters: null,
  })
  test('joins distance and duration with a middot', () => {
    expect(formatActivitySummary(metrics(4200, 3900))).toBe('4.2 km · 1h 5m')
  })
  test('sub-kilometre distance and short duration', () => {
    expect(formatActivitySummary(metrics(850, 90))).toBe('850 m · 1m 30s')
  })
})
