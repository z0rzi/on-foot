import { movingDurationMs } from '../duration'

describe('movingDurationMs', () => {
  it('subtracts accumulated paused time from wall time', () => {
    expect(movingDurationMs(1000, 7000, 2000)).toBe(4000)
  })
  it('equals wall time when there was no pause', () => {
    expect(movingDurationMs(1000, 7000, 0)).toBe(6000)
  })
  it('clamps a negative result to 0', () => {
    expect(movingDurationMs(7000, 1000, 0)).toBe(0)
  })
})
