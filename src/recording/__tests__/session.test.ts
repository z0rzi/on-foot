import { applyPause, applyResume, movingElapsedMs } from '../session'
import { RecordingSession } from '../../data/activities/types'

const base: RecordingSession = { id: 1, startedAt: 1000, linkedTrailId: null, pausedAt: null, pausedMs: 0 }

describe('movingElapsedMs', () => {
  it('recording: elapsed since start minus accumulated pause', () => {
    expect(movingElapsedMs({ ...base, pausedMs: 2000 }, 11000)).toBe(8000)
  })
  it('paused: frozen at pausedAt minus accumulated pause', () => {
    expect(movingElapsedMs({ ...base, pausedAt: 9000, pausedMs: 2000 }, 999999)).toBe(6000)
  })
  it('clamps negatives to 0', () => {
    expect(movingElapsedMs({ ...base, pausedMs: 999999 }, 1500)).toBe(0)
  })
})

describe('applyPause', () => {
  it('stamps pausedAt with now', () => {
    expect(applyPause(base, 5000)).toEqual({ ...base, pausedAt: 5000 })
  })
})

describe('applyResume', () => {
  it('accumulates the just-ended pause into pausedMs and clears pausedAt', () => {
    expect(applyResume({ ...base, pausedAt: 5000, pausedMs: 1000 }, 8000)).toEqual({
      ...base,
      pausedAt: null,
      pausedMs: 4000,
    })
  })
  it('accumulates across multiple cycles', () => {
    const afterFirst = applyResume({ ...base, pausedAt: 3000 }, 4000) // +1000
    const paused2 = applyPause(afterFirst, 9000)
    expect(applyResume(paused2, 11000)).toEqual({ ...base, pausedAt: null, pausedMs: 3000 }) // 1000 + 2000
  })
})
