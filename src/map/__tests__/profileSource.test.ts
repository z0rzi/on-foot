import { profileSourceFor } from '../profileSource'
import type { Trail } from '../../data/trails/types'
import type { Activity, TrackPoint } from '../../data/activities/types'

const trailWith = (segments: Trail['geometry']['segments']): Trail => ({
  id: 1, name: 'T', difficulty: 'easy', description: null,
  metrics: { distanceMeters: 0, elevationGainMeters: 0, elevationLossMeters: 0 },
  geometry: { segments, waypoints: [] },
  createdAt: 0, updatedAt: 0,
})

const activityWith = (segments: Activity['geometry']['segments']): Activity => ({
  id: 1, name: 'A', effort: 'easy', comments: null, linkedTrailId: null,
  metrics: { distanceMeters: 0, durationSeconds: 0, elevationGainMeters: 0, elevationLossMeters: 0 },
  geometry: { segments },
  startedAt: 0, endedAt: 0, createdAt: 0,
})

const liveSegment = (...lngs: number[]): TrackPoint[] => lngs.map((lng) => ({ lat: 0, lng, ele: 100, t: 0 }))

describe('profileSourceFor', () => {
  it('returns null in free mode', () => {
    expect(profileSourceFor('free', null, null, [])).toBeNull()
  })

  it('returns the trail segments in trail mode', () => {
    const trail = trailWith([[{ lat: 0, lng: 0, ele: 1 }]])
    expect(profileSourceFor('trail', trail, null, [])).toEqual({
      kind: 'trail',
      segments: trail.geometry.segments,
    })
  })

  it('returns null in trail mode without a trail', () => {
    expect(profileSourceFor('trail', null, null, [])).toBeNull()
  })

  it('returns the activity segments in activity mode', () => {
    const activity = activityWith([[{ lat: 0, lng: 0, ele: 1, t: 0 }]])
    expect(profileSourceFor('activity', null, activity, [])).toEqual({
      kind: 'activity',
      segments: activity.geometry.segments,
    })
  })

  it('returns null in activity mode without an activity', () => {
    expect(profileSourceFor('activity', null, null, [])).toBeNull()
  })

  it('prefers the followed trail over live points in recording mode', () => {
    const trail = trailWith([[{ lat: 0, lng: 0, ele: 1 }]])
    expect(profileSourceFor('recording', trail, null, [liveSegment(1)])).toEqual({
      kind: 'trail',
      segments: trail.geometry.segments,
    })
  })

  it('returns the live segments by reference when recording without a trail', () => {
    const liveSegments = [liveSegment(20, 21), liveSegment(10, 11)]
    const source = profileSourceFor('recording', null, null, liveSegments)
    expect(source?.kind).toBe('live')
    expect(source?.segments).toBe(liveSegments)
  })

  it('returns the followed trail segments by reference, so the display memo holds across fixes', () => {
    const trail = trailWith([[{ lat: 0, lng: 0, ele: 1 }]])
    const first = profileSourceFor('recording', trail, null, [liveSegment(1)])
    const second = profileSourceFor('recording', trail, null, [liveSegment(1, 2)])
    expect(first?.segments).toBe(trail.geometry.segments)
    expect(second?.segments).toBe(first?.segments)
  })
})
