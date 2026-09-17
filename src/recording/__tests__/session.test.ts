import { applyPause, applyRelaunch, applyResume, movingElapsedMs } from '../session'
import { RecordingSession } from '../../data/activities/types'

const base: RecordingSession = {
  id: 1, startedAt: 1000, linkedTrailId: null, pausedAt: null, pausedMs: 0, currentSegment: 0, segmentStartedAt: 1000,
}

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
  it('accumulates the just-ended pause into pausedMs, clears pausedAt, opens the next segment from now', () => {
    expect(applyResume({ ...base, pausedAt: 5000, pausedMs: 1000 }, 8000)).toEqual({
      ...base,
      pausedAt: null,
      pausedMs: 4000,
      currentSegment: 1,
      segmentStartedAt: 8000,
    })
  })
  it('increments the segment on each resume across cycles', () => {
    const afterFirst = applyResume({ ...base, pausedAt: 3000 }, 4000) // seg 1
    const paused2 = applyPause(afterFirst, 9000)
    expect(applyResume(paused2, 11000)).toEqual({
      ...base, pausedAt: null, pausedMs: 3000, currentSegment: 2, segmentStartedAt: 11000,
    })
  })
})

describe('applyRelaunch', () => {
  it('opens the next segment from now and leaves the timing untouched', () => {
    const running = { ...base, pausedMs: 1500, currentSegment: 2 }
    expect(applyRelaunch(running, 20000)).toEqual({ ...running, currentSegment: 3, segmentStartedAt: 20000 })
  })
})
