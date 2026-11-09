import { formatBytes, formatDistance, formatDuration, formatElevation } from '../units'

describe('formatBytes', () => {
  it('uses GB at a billion bytes and above, to one decimal', () => {
    expect(formatBytes(1_000_000_000)).toBe('1.0 GB')
    expect(formatBytes(1_500_000_000)).toBe('1.5 GB')
  })

  it('uses whole MB from a million bytes up to a billion', () => {
    expect(formatBytes(1_000_000)).toBe('1 MB')
    expect(formatBytes(5_400_000)).toBe('5 MB')
  })

  it('uses whole KB below a million bytes', () => {
    expect(formatBytes(250_000)).toBe('250 KB')
  })

  it('never reports 0 KB, because a pack that exists is not nothing', () => {
    expect(formatBytes(200)).toBe('1 KB')
    expect(formatBytes(0)).toBe('1 KB')
  })
})

describe('formatDistance', () => {
  test('switches to km at 1000 m', () => {
    expect(formatDistance(450)).toBe('450 m')
    expect(formatDistance(1500)).toBe('1.5 km')
    expect(formatDistance(1000)).toBe('1.0 km')
  })
})

describe('formatElevation', () => {
  test('rounds to whole metres', () => {
    expect(formatElevation(250.4)).toBe('250 m')
  })
  test('shows a dash when elevation is unknown', () => {
    expect(formatElevation(null)).toBe('—')
  })
})

describe('formatDuration', () => {
  it('formats seconds under a minute', () => {
    expect(formatDuration(45)).toBe('45 s')
  })
  it('formats whole minutes without seconds', () => {
    expect(formatDuration(600)).toBe('10 min')
  })
  it('formats minutes and two-digit seconds', () => {
    expect(formatDuration(125)).toBe('2 min 05 s')
  })
  it('formats hours and two-digit minutes, without seconds', () => {
    expect(formatDuration(3725)).toBe('1 h 02')
  })
  it('keeps the minutes of a whole hour', () => {
    expect(formatDuration(7200)).toBe('2 h 00')
  })
  it('clamps negatives to 0 s', () => {
    expect(formatDuration(-5)).toBe('0 s')
  })
})
