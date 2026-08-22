import { formatDuration } from '../format'

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
