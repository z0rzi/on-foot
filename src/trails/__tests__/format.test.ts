import { formatTrailAhead, formatTrailSummary, trailMetricTiles } from '../format'

describe('formatTrailSummary', () => {
  test('includes gain when known', () => {
    expect(formatTrailSummary({ distanceMeters: 1500, elevationGainMeters: 340, elevationLossMeters: 300 }))
      .toBe('1.5 km · 340 m gain')
  })
  test('states when elevation is missing', () => {
    expect(formatTrailSummary({ distanceMeters: 1500, elevationGainMeters: null, elevationLossMeters: null }))
      .toBe('1.5 km · no elevation data')
  })
})

describe('trailMetricTiles', () => {
  test('the distance, the elevation gain and the elevation loss, in that order', () => {
    expect(trailMetricTiles({ distanceMeters: 12400, elevationGainMeters: 340, elevationLossMeters: 300 })).toEqual([
      { label: 'Distance', value: '12.4 km' },
      { label: 'Elevation gain', value: '340 m' },
      { label: 'Elevation loss', value: '300 m' },
    ])
  })
  test('an elevation it does not know reads as a dash', () => {
    expect(trailMetricTiles({ distanceMeters: 800, elevationGainMeters: null, elevationLossMeters: null }).map((t) => t.value))
      .toEqual(['800 m', '—', '—'])
  })
})

describe('formatTrailAhead', () => {
  test('before a climb, the time to the trail end with its distance in brackets, then the time to the climb, its distance in brackets, and its height', () => {
    expect(formatTrailAhead({
      leftMeters: 12400,
      walkingSeconds: 3 * 3600 + 10 * 60,
      climb: { kind: 'next', distanceMeters: 1200, walkingSeconds: 12 * 60, heightMeters: 340 },
    })).toEqual([
      { kind: 'end', text: 'Trail end in 3 h 10 (12.4 km)' },
      { kind: 'climb', text: 'Next climb in 12 min (1.2 km) · 340 m to climb' },
    ])
  })
  test('on a climb, the time to its top, then the height left in brackets', () => {
    expect(formatTrailAhead({ leftMeters: 12400, walkingSeconds: 3 * 3600, climb: { kind: 'climbing', heightMeters: 230, walkingSeconds: 600 } })[1])
      .toEqual({ kind: 'climb', text: 'Climbing · 10 min to the top (230 m up)' })
  })
  test('past the last climb, says so', () => {
    expect(formatTrailAhead({ leftMeters: 12400, walkingSeconds: 3 * 3600, climb: { kind: 'none' } })[1])
      .toEqual({ kind: 'climb', text: 'No climb left' })
  })
  test('under a kilometre, distances read in metres', () => {
    expect(formatTrailAhead({ leftMeters: 800, walkingSeconds: 600, climb: { kind: 'next', distanceMeters: 300, walkingSeconds: 240, heightMeters: 40 } })).toEqual([
      { kind: 'end', text: 'Trail end in 10 min (800 m)' },
      { kind: 'climb', text: 'Next climb in 4 min (300 m) · 40 m to climb' },
    ])
  })
  test('a height always reads in metres, never in km', () => {
    expect(formatTrailAhead({ leftMeters: 12400, walkingSeconds: 3 * 3600, climb: { kind: 'climbing', heightMeters: 1200, walkingSeconds: 600 } })[1])
      .toEqual({ kind: 'climb', text: 'Climbing · 10 min to the top (1200 m up)' })
  })
  test('a walking time rounds to the minute', () => {
    expect(formatTrailAhead({ leftMeters: 5000, walkingSeconds: 3899, climb: { kind: 'none' } })[0])
      .toEqual({ kind: 'end', text: 'Trail end in 1 h 05 (5.0 km)' })
  })
  test.each([0, 20])('a walking time never reads under 1 min (%i s)', (seconds) => {
    expect(formatTrailAhead({ leftMeters: 20, walkingSeconds: seconds, climb: { kind: 'none' } })[0])
      .toEqual({ kind: 'end', text: 'Trail end in 1 min (20 m)' })
  })
  test.each([0, 0.3])('with no distance left, the end line says the walk is at the trail end (%f m)', (left) => {
    expect(formatTrailAhead({ leftMeters: left, walkingSeconds: 0, climb: { kind: 'none' } })[0])
      .toEqual({ kind: 'end', text: 'At the trail end' })
  })
  test('with no puck, the one line says the walk is not on the trail', () => {
    expect(formatTrailAhead(null)).toEqual([{ kind: 'offTrail', text: 'Not on the trail' }])
  })
})
