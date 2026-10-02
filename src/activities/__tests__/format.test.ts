import { formatCalendarClockSeconds, formatClockSeconds, formatClockTime, formatDuration, formatActivityDate, formatActivitySummary, formatPace, formatSpeed, formatStopwatch } from '../format'
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

describe('formatPace', () => {
  it('formats min/km as M:SS', () => {
    expect(formatPace(1000, 480)).toBe('8:00') // 480 s/km
    expect(formatPace(2000, 480)).toBe('4:00') // 240 s/km
    expect(formatPace(1000, 510)).toBe('8:30')
  })
  it('zero-pads seconds', () => {
    expect(formatPace(1000, 489)).toBe('8:09')
  })
  it('carries rounded 60 seconds up to the next minute', () => {
    expect(formatPace(1000, 119.6)).toBe('2:00')
  })
  it('returns — when distance or duration is non-positive', () => {
    expect(formatPace(0, 480)).toBe('—')
    expect(formatPace(1000, 0)).toBe('—')
  })
})

describe('formatSpeed', () => {
  it('formats km/h to one decimal', () => {
    expect(formatSpeed(1000, 360)).toBe('10.0') // 1 km in 0.1 h
    expect(formatSpeed(2400, 3600)).toBe('2.4')
  })
  it('returns — when duration is non-positive', () => {
    expect(formatSpeed(1000, 0)).toBe('—')
  })
})

describe('formatStopwatch', () => {
  it('formats under an hour as M:SS', () => {
    expect(formatStopwatch(0)).toBe('0:00')
    expect(formatStopwatch(45)).toBe('0:45')
    expect(formatStopwatch(125)).toBe('2:05')
  })
  it('formats an hour or more as H:MM:SS with zero-padded minutes', () => {
    expect(formatStopwatch(3600)).toBe('1:00:00')
    expect(formatStopwatch(8107)).toBe('2:15:07')
  })
  it('floors fractional seconds and clamps negatives to zero', () => {
    expect(formatStopwatch(59.9)).toBe('0:59')
    expect(formatStopwatch(-5)).toBe('0:00')
  })
})

describe('formatClockTime', () => {
  it('formats local time as zero-padded hours and minutes', () => {
    expect(formatClockTime(new Date(2026, 8, 14, 13, 56).getTime())).toBe('13:56')
    expect(formatClockTime(new Date(2026, 8, 14, 9, 5).getTime())).toBe('09:05')
  })
})

describe('formatClockSeconds', () => {
  it('pads hours, minutes and seconds to two digits each', () => {
    const t = new Date(2026, 9, 2, 9, 5, 7).getTime()
    expect(formatClockSeconds(t)).toBe('09:05:07')
  })

  it('renders an afternoon time on the 24-hour clock', () => {
    const t = new Date(2026, 9, 2, 14, 49, 30).getTime()
    expect(formatClockSeconds(t)).toBe('14:49:30')
  })
})

describe('formatCalendarClockSeconds', () => {
  it('prefixes the padded month and day to the clock time', () => {
    const t = new Date(2026, 9, 2, 9, 5, 7).getTime()
    expect(formatCalendarClockSeconds(t)).toBe('10-02 09:05:07')
  })

  it('pads a single-digit month', () => {
    const t = new Date(2026, 0, 9, 23, 59, 59).getTime()
    expect(formatCalendarClockSeconds(t)).toBe('01-09 23:59:59')
  })
})
