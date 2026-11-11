import { routeTiming } from '../routeTiming'

const P = { lat: 1, lng: 2, ele: null }

test('routeTiming carries the kind, the point count and the duration to one decimal', () => {
  expect(routeTiming('trail', [[P, P], [P]], 12.3456)).toEqual({ kind: 'trail', points: 3, ms: 12.3 })
})

test('routeTiming holds no coordinate', () => {
  const detail = JSON.stringify(routeTiming('activity', [[{ lat: 45.9237, lng: 6.8694, ele: 1035 }]], 1))
  expect(detail).not.toContain('45.9237')
  expect(detail).not.toContain('6.8694')
})

test('routeTiming reads an empty geometry as zero points', () => {
  expect(routeTiming('activity', [], 0.04)).toEqual({ kind: 'activity', points: 0, ms: 0 })
})
