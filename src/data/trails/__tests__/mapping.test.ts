import { serializeGeometry, deserializeGeometry, rowToSummary, rowToTrail, inputToInsertValues, TrailRow } from '../mapping'
import { NewTrailInput } from '../types'

const ROW: TrailRow = {
  id: 7, name: 'Ridge', difficulty: 'hard',
  distanceMeters: 5200, elevationGainMeters: 250, elevationLossMeters: 180,
  description: 'nice', geometry: '{"points":[{"lat":1,"lng":2,"ele":10}],"waypoints":[]}',
  createdAt: 1000, updatedAt: 2000,
}

test('geometry round-trips through JSON', () => {
  const g = { points: [{ lat: 1, lng: 2, ele: null }], waypoints: [] }
  expect(deserializeGeometry(serializeGeometry(g))).toEqual(g)
})

test('deserializeGeometry defaults missing arrays to empty', () => {
  expect(deserializeGeometry('{}')).toEqual({ points: [], waypoints: [] })
})

test('rowToSummary exposes list fields and omits geometry/description', () => {
  const s = rowToSummary(ROW)
  expect(s).toEqual({
    id: 7, name: 'Ridge', difficulty: 'hard',
    metrics: { distanceMeters: 5200, elevationGainMeters: 250, elevationLossMeters: 180 },
    createdAt: 1000,
  })
  expect(s).not.toHaveProperty('geometry')
})

test('rowToTrail adds description, geometry, updatedAt', () => {
  const t = rowToTrail(ROW)
  expect(t.description).toBe('nice')
  expect(t.geometry).toEqual({ points: [{ lat: 1, lng: 2, ele: 10 }], waypoints: [] })
  expect(t.updatedAt).toBe(2000)
})

test('inputToInsertValues serializes geometry and stamps both timestamps', () => {
  const input: NewTrailInput = {
    name: 'A', difficulty: 'easy', description: null,
    metrics: { distanceMeters: 1, elevationGainMeters: 2, elevationLossMeters: 3 },
    geometry: { points: [], waypoints: [] },
  }
  const v = inputToInsertValues(input, 555)
  expect(v).toEqual({
    name: 'A', difficulty: 'easy',
    distanceMeters: 1, elevationGainMeters: 2, elevationLossMeters: 3,
    description: null, geometry: '{"points":[],"waypoints":[]}',
    createdAt: 555, updatedAt: 555,
  })
})
