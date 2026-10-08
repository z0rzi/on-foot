import { formatBytes } from '../units'

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
