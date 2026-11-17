import { selectLiveSegments } from '../liveSegments'
import type { LiveTrackPoint } from '../../data/activities/types'

const point = (segment: number, t: number): LiveTrackPoint => ({ lat: 45 + t / 1000, lng: 6, ele: 1000 + t, t, segment })

describe('selectLiveSegments', () => {
  it('splits the track where the segment changes', () => {
    const livePoints = [point(0, 1), point(0, 2), point(1, 3)]
    expect(selectLiveSegments({ livePoints })).toEqual([
      [{ lat: 45.001, lng: 6, ele: 1001, t: 1 }, { lat: 45.002, lng: 6, ele: 1002, t: 2 }],
      [{ lat: 45.003, lng: 6, ele: 1003, t: 3 }],
    ])
  })

  it('has no segment for an empty track', () => {
    expect(selectLiveSegments({ livePoints: [] })).toEqual([])
  })

  it('returns the same array while the track is unchanged', () => {
    const livePoints = [point(0, 1), point(0, 2)]
    const first = selectLiveSegments({ livePoints })
    expect(selectLiveSegments({ livePoints })).toBe(first)
  })

  it('starts a segment at the first point after a pause and resume', () => {
    const paused = [point(0, 1), point(0, 2)]
    const before = selectLiveSegments({ livePoints: paused })
    const resumed = selectLiveSegments({ livePoints: [...paused, point(1, 60)] })
    expect(before).toHaveLength(1)
    expect(resumed).toHaveLength(2)
    expect(resumed[1]).toEqual([{ lat: 45.06, lng: 6, ele: 1060, t: 60 }])
  })
})
