import { profileSegmentsFor } from '../profileSource'
import type { Trail } from '../../data/trails/types'
import type { Activity, LiveTrackPoint } from '../../data/activities/types'

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

const livePoint = (segment: number, lng: number): LiveTrackPoint => ({ lat: 0, lng, ele: 100, t: 0, segment })

describe('profileSegmentsFor', () => {
  it('returns null in free mode', () => {
    expect(profileSegmentsFor('free', null, null, [])).toBeNull()
  })

  it('returns the trail segments in trail mode', () => {
    const trail = trailWith([[{ lat: 0, lng: 0, ele: 1 }]])
    expect(profileSegmentsFor('trail', trail, null, [])).toBe(trail.geometry.segments)
  })

  it('returns null in trail mode without a trail', () => {
    expect(profileSegmentsFor('trail', null, null, [])).toBeNull()
  })

  it('returns the activity segments in activity mode', () => {
    const activity = activityWith([[{ lat: 0, lng: 0, ele: 1, t: 0 }]])
    expect(profileSegmentsFor('activity', null, activity, [])).toBe(activity.geometry.segments)
  })

  it('returns null in activity mode without an activity', () => {
    expect(profileSegmentsFor('activity', null, null, [])).toBeNull()
  })

  it('prefers the followed trail over live points in recording mode', () => {
    const trail = trailWith([[{ lat: 0, lng: 0, ele: 1 }]])
    const livePoints = [livePoint(0, 1)]
    expect(profileSegmentsFor('recording', trail, null, livePoints)).toBe(trail.geometry.segments)
  })

  it('groups live points by segment, in segment order, when recording without a trail', () => {
    const livePoints = [livePoint(1, 10), livePoint(0, 20), livePoint(1, 11), livePoint(0, 21)]
    expect(profileSegmentsFor('recording', null, null, livePoints)).toEqual([
      [
        { lat: 0, lng: 20, ele: 100, t: 0 },
        { lat: 0, lng: 21, ele: 100, t: 0 },
      ],
      [
        { lat: 0, lng: 10, ele: 100, t: 0 },
        { lat: 0, lng: 11, ele: 100, t: 0 },
      ],
    ])
  })
})
