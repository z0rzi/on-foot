import { trailAhead, type TrailAhead } from '../trailAhead'
import { displaySlopeBands } from '../slope'
import type { ElevationProfile } from '../profile'
import type { RouteDisplay } from '../routeDisplay'

// One sample every 100 m, elevations in metres, all on one segment.
function display(eles: number[], smoothingMeters = 0): RouteDisplay {
  return segmentedDisplay(eles.map((ele, i) => ({ distance: i * 100, ele, segment: 0 })), smoothingMeters)
}

function segmentedDisplay(
  points: { distance: number; ele: number; segment: number }[],
  smoothingMeters = 0,
): RouteDisplay {
  const samples = points.map((p) => ({ ...p, lat: 0, lng: 0 }))
  const eles = points.map((p) => p.ele)
  const profile: ElevationProfile = {
    samples,
    minEle: Math.min(...eles),
    maxEle: Math.max(...eles),
    totalDistance: points[points.length - 1].distance,
  }
  return { kind: 'trail', profile, ...displaySlopeBands(profile, smoothingMeters) }
}

const climbTime = ({ climb }: TrailAhead) => (climb.kind === 'none' ? 0 : climb.walkingSeconds)

// 0-200 flat · 200-500 up 30 m · 500-700 flat.
const trail = display([100, 100, 100, 110, 120, 130, 130, 130])

describe('trailAhead', () => {
  it('before a climb, gives the distance left, the distance to the climb and its height', () => {
    expect(trailAhead(trail, 100, 1)).toMatchObject({ leftMeters: 600, climb: { kind: 'next', distanceMeters: 100, heightMeters: 30 } })
  })

  it('on a climb, gives the height left to its top', () => {
    expect(trailAhead(trail, 300, 1)).toMatchObject({ leftMeters: 400, climb: { kind: 'climbing', heightMeters: 20 } })
  })

  it('past the last climb, has no climb left', () => {
    expect(trailAhead(trail, 600, 1)).toMatchObject({ leftMeters: 100, climb: { kind: 'none' } })
  })

  it('at the end, has nothing left', () => {
    expect(trailAhead(trail, 700, 1)).toMatchObject({ leftMeters: 0, climb: { kind: 'none' } })
  })

  it('past the end, never counts below 0', () => {
    expect(trailAhead(trail, 900, 1)).toMatchObject({ leftMeters: 0, climb: { kind: 'none' } })
  })

  it('splits a climb at a drop of more than 10 m', () => {
    // 0-300 up 30 m · 300-500 down 30 m · 500-900 up 40 m.
    const hills = display([100, 110, 120, 130, 115, 100, 110, 120, 130, 140])
    expect(trailAhead(hills, 350, 1)).toMatchObject({ leftMeters: 550, climb: { kind: 'next', distanceMeters: 150, heightMeters: 40 } })
  })

  it('splits a climb at 400 m of flat', () => {
    // 0-300 up 30 m · 300-700 flat · 700-1000 up 30 m.
    const steps = display([100, 110, 120, 130, 130, 130, 130, 130, 140, 150, 160])
    expect(trailAhead(steps, 500, 1)).toMatchObject({ leftMeters: 500, climb: { kind: 'next', distanceMeters: 200, heightMeters: 30 } })
  })

  it('keeps a climb whole across a short flat', () => {
    // 100-400 up 30 m · 400-500 flat · 500-800 up 30 m.
    const climb = display([100, 100, 110, 120, 130, 130, 140, 150, 160])
    expect(trailAhead(climb, 0, 1)).toMatchObject({ leftMeters: 800, climb: { kind: 'next', distanceMeters: 100, heightMeters: 60 } })
  })

  it('keeps a 5 % climb whole across 150 m of flat', () => {
    // A point every 50 m: 0-400 up 20 m · 400-550 flat · 550-950 up 20 m.
    const eles = [...Array.from({ length: 9 }, (_, i) => 100 + 2.5 * i), 120, 120, ...Array.from({ length: 9 }, (_, i) => 120 + 2.5 * i)]
    const moderate = segmentedDisplay(eles.map((ele, i) => ({ distance: i * 50, ele, segment: 0 })))
    expect(trailAhead(moderate, 0, 1)).toMatchObject({ leftMeters: 950, climb: { kind: 'climbing', heightMeters: 40 } })
  })

  it('keeps a climb whole across a 10 m flat', () => {
    // 0-300 up 30 m · 300-310 flat · 310-610 up 30 m.
    const climb = segmentedDisplay([0, 100, 200, 300, 310, 410, 510, 610].map((distance, i) => (
      { distance, ele: [100, 110, 120, 130, 130, 140, 150, 160][i], segment: 0 }
    )))
    expect(trailAhead(climb, 0, 1)).toMatchObject({ leftMeters: 610, climb: { kind: 'climbing', heightMeters: 60 } })
  })

  it('keeps a climb whole across a 5 m dip', () => {
    // 100-400 up 30 m · 400-500 down 5 m · 500-800 up 30 m.
    const climb = display([100, 100, 110, 120, 130, 125, 135, 145, 155])
    expect(trailAhead(climb, 0, 1)).toMatchObject({ leftMeters: 800, climb: { kind: 'next', distanceMeters: 100, heightMeters: 55 } })
  })

  it('skips a rise of 15 m', () => {
    expect(trailAhead(display([100, 100, 105, 110, 115, 115, 115]), 0, 1)).toMatchObject({ leftMeters: 600, climb: { kind: 'none' } })
  })

  it('does not count 2 km rising at 1 % as a climb', () => {
    const gentle = display(Array.from({ length: 21 }, (_, i) => 100 + i))
    expect(trailAhead(gentle, 0, 1)).toMatchObject({ leftMeters: 2000, climb: { kind: 'none' } })
  })

  it('does not count a rise averaging under 4 % as a climb, steep steps or not', () => {
    // 5 m up over 100 m, then 200 m flat, five times: 25 m over 1.3 km.
    const stairs = display([100, 105, 105, 105, 110, 110, 110, 115, 115, 115, 120, 120, 120, 125, 125, 125])
    expect(trailAhead(stairs, 0, 1)).toMatchObject({ leftMeters: 1500, climb: { kind: 'none' } })
  })

  it('starts a climb where it steepens, not on the gentle approach before it', () => {
    // 0-600 up 2 % · 600-900 up 10 %.
    const approach = display([100, 102, 104, 106, 108, 110, 112, 122, 132, 142])
    expect(trailAhead(approach, 0, 1)).toMatchObject({ leftMeters: 900, climb: { kind: 'next', distanceMeters: 600, heightMeters: 30 } })
  })

  it('finds a steep climb followed by a long gentle rise, its top where the steep part ends', () => {
    // 100-400 up 10 % · 400-3400 up 0.5 %.
    const gentleRidge = display([100, 100, 110, 120, 130, ...Array.from({ length: 30 }, (_, i) => 130.5 + 0.5 * i)])
    expect(trailAhead(gentleRidge, 0, 1)).toMatchObject({ leftMeters: 3400, climb: { kind: 'next', distanceMeters: 100, heightMeters: 30 } })
  })

  it.each([20, 10])('neither hides nor moves a steep climb behind a lone steep step and %i00 m at 1 %%', (approach) => {
    // 0-100 up 5 % · then up 1 % · then 500 m up 10 %.
    const eles = [
      100,
      ...Array.from({ length: approach + 1 }, (_, i) => 105 + i),
      ...Array.from({ length: 5 }, (_, i) => 115 + approach + 10 * i),
    ]
    expect(trailAhead(display(eles), 0, 1))
      .toMatchObject({ climb: { kind: 'next', distanceMeters: 100 + 100 * approach, heightMeters: 50 } })
  })

  it('takes Tobler\'s flat time over a flat trail', () => {
    // 1 km at 6 · e^(−0.175) ≈ 5.037 km/h.
    expect(trailAhead(display(Array(11).fill(100)), 0, 1).walkingSeconds).toBeCloseTo(714.75, 1)
  })

  it('takes longer over a climb than over the same distance flat', () => {
    const flat = trailAhead(display(Array(11).fill(100)), 0, 1).walkingSeconds
    const climb = trailAhead(display(Array.from({ length: 11 }, (_, i) => 100 + 10 * i)), 0, 1).walkingSeconds
    expect(climb).toBeGreaterThan(flat)
  })

  it('before a climb, gives the walking time to its foot', () => {
    // 100 m flat at 6 · e^(−0.175) ≈ 5.037 km/h.
    expect(trailAhead(trail, 100, 1).climb).toMatchObject({ kind: 'next', walkingSeconds: expect.closeTo(71.5, 1) })
  })

  it('on a climb, gives the walking time to its top', () => {
    // 200 m up 10 % at 6 · e^(−0.525) ≈ 3.549 km/h.
    expect(trailAhead(trail, 300, 1).climb).toMatchObject({ kind: 'climbing', walkingSeconds: expect.closeTo(202.9, 1) })
  })

  it.each([100, 300])('doubles every walking time with a factor of 2 (at %i m)', (at) => {
    const one = trailAhead(trail, at, 1)
    const two = trailAhead(trail, at, 2)
    expect(two.walkingSeconds).toBeCloseTo(2 * one.walkingSeconds)
    expect(climbTime(two)).toBeCloseTo(2 * climbTime(one))
    expect(climbTime(one)).toBeGreaterThan(0)
  })

  it('gives no time to the gap between two segments', () => {
    // 0-200 flat · gap to 1200 · 1200-1400 flat.
    const gapped = segmentedDisplay([
      { distance: 0, ele: 100, segment: 0 },
      { distance: 100, ele: 100, segment: 0 },
      { distance: 200, ele: 100, segment: 0 },
      { distance: 1200, ele: 100, segment: 1 },
      { distance: 1300, ele: 100, segment: 1 },
      { distance: 1400, ele: 100, segment: 1 },
    ])
    // 400 m walked at 6 · e^(−0.175) ≈ 5.037 km/h.
    expect(trailAhead(gapped, 0, 1)).toMatchObject({ leftMeters: 1400 })
    expect(trailAhead(gapped, 0, 1).walkingSeconds).toBeCloseTo(285.9, 1)
  })

  it('never runs a climb across the gap between two segments', () => {
    // 0-200 up 15 m · gap · 300-500 up 12 m: 30 m overall, under 20 m on either side.
    const gapped = segmentedDisplay([
      { distance: 0, ele: 100, segment: 0 },
      { distance: 100, ele: 110, segment: 0 },
      { distance: 200, ele: 115, segment: 0 },
      { distance: 300, ele: 118, segment: 1 },
      { distance: 400, ele: 125, segment: 1 },
      { distance: 500, ele: 130, segment: 1 },
    ])
    expect(trailAhead(gapped, 0, 1)).toMatchObject({ leftMeters: 500, climb: { kind: 'none' } })
  })

  it('over an empty profile, has nothing left and no climb', () => {
    const empty: ElevationProfile = { samples: [], minEle: Infinity, maxEle: -Infinity, totalDistance: 0 }
    const none: RouteDisplay = { kind: 'trail', profile: empty, smoothed: empty, bands: [] }
    expect(trailAhead(none, 100, 1)).toEqual({ leftMeters: 0, walkingSeconds: 0, climb: { kind: 'none' } })
  })

  it('over a one-point profile, has nothing left and no climb', () => {
    expect(trailAhead(segmentedDisplay([{ distance: 0, ele: 100, segment: 0 }]), 100, 1))
      .toEqual({ leftMeters: 0, walkingSeconds: 0, climb: { kind: 'none' } })
  })

  it.each([0, 100, 300, 600])('finds the same climb whatever the smoothing preference (%i m)', (smoothing) => {
    expect(trailAhead(display([100, 100, 100, 110, 120, 130, 130, 130], smoothing), 100, 1))
      .toMatchObject({ leftMeters: 600, climb: { kind: 'next', distanceMeters: 100, heightMeters: 30 } })
  })
})
