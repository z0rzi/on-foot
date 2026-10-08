import { boundsForTrail } from '../bounds'
import { boundsForPoints } from '../../geo'

describe('boundsForTrail', () => {
  test('returns null for no points', () => {
    expect(boundsForTrail([], 2)).toBeNull()
  })
  test('a single point becomes a margin-sized box centred on it', () => {
    const b = boundsForTrail([{ lat: 0, lng: 0 }], 111)!
    // ~111 km ≈ 1° of latitude
    expect(b.ne[1]).toBeCloseTo(1, 1)
    expect(b.sw[1]).toBeCloseTo(-1, 1)
    expect(b.ne[0]).toBeGreaterThan(0)
    expect(b.sw[0]).toBeLessThan(0)
  })
  test('spans all points then expands by the margin', () => {
    const b = boundsForTrail(
      [{ lat: 10, lng: 20 }, { lat: 12, lng: 25 }],
      0,
    )!
    expect(b.ne).toEqual([25, 12])
    expect(b.sw).toEqual([20, 10])
  })
  test('ne is north-east, sw is south-west', () => {
    const b = boundsForTrail([{ lat: 5, lng: 5 }, { lat: -5, lng: -5 }], 1)!
    expect(b.ne[0]).toBeGreaterThan(b.sw[0])
    expect(b.ne[1]).toBeGreaterThan(b.sw[1])
  })
  test('a zero margin is exactly the raw point bounds', () => {
    const points = [
      { lat: 42.8, lng: 0.1 },
      { lat: 42.9, lng: 0.3 },
      { lat: 42.7, lng: 0.2 },
    ]
    expect(boundsForTrail(points, 0)).toEqual(boundsForPoints(points))
  })
})
