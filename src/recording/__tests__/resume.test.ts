import { lastKnownRecordingAt, resumeActionFor } from '../resume'

const session = { id: 1, startedAt: 0, linkedTrailId: null as number | null, pausedAt: null as number | null, pausedMs: 0, currentSegment: 0, segmentStartedAt: 10_000 }
const point = (t: number) => ({ lat: 45, lng: 6, ele: null, t })

describe('resumeActionFor', () => {
  it('no session → none', () => {
    expect(resumeActionFor(null, null, 100_000)).toBe('none')
  })
  it('paused session → paused', () => {
    expect(resumeActionFor({ ...session, pausedAt: 500 }, point(99_000), 100_000)).toBe('paused')
  })
  it('a last point 30 s old → continue', () => {
    expect(resumeActionFor(session, point(70_000), 100_000)).toBe('continue')
  })
  it('a last point just over 30 s old → resume, a cut', () => {
    expect(resumeActionFor(session, point(69_999), 100_000)).toBe('resume')
  })
  it('a segment begun 30 s ago with no point yet → continue', () => {
    expect(resumeActionFor({ ...session, segmentStartedAt: 70_000 }, null, 100_000)).toBe('continue')
  })
  it('a segment begun after an old last point → continue', () => {
    expect(resumeActionFor({ ...session, segmentStartedAt: 80_000 }, point(20_000), 100_000)).toBe('continue')
  })
  it('a segment begun long ago with no point → resume', () => {
    expect(resumeActionFor(session, null, 100_000)).toBe('resume')
  })
})

describe('lastKnownRecordingAt', () => {
  it('is the last point when it is later than the segment start', () => {
    expect(lastKnownRecordingAt(session, point(42_000))).toBe(42_000)
  })
  it('is the segment start when the last point is earlier', () => {
    expect(lastKnownRecordingAt({ ...session, segmentStartedAt: 50_000 }, point(42_000))).toBe(50_000)
  })
  it('is the segment start with no point', () => {
    expect(lastKnownRecordingAt(session, null)).toBe(10_000)
  })
})
