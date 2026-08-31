import { serializeGeometry, deserializeGeometry, rowToSummary, rowToTrail, inputToInsertValues, updateToValues, TrailRow } from '../mapping'
import { NewTrailInput, TrailUpdate } from '../types'

const ROW: TrailRow = {
  id: 7, name: 'Ridge', difficulty: 'hard',
  distanceMeters: 5200, elevationGainMeters: 250, elevationLossMeters: 180,
  description: 'nice', geometry: '{"segments":[[{"lat":1,"lng":2,"ele":10}]],"waypoints":[]}',
  createdAt: 1000, updatedAt: 2000,
}

test('geometry round-trips segments through JSON', () => {
  const g = { segments: [[{ lat: 1, lng: 2, ele: null }]], waypoints: [] }
  expect(deserializeGeometry(serializeGeometry(g))).toEqual(g)
})

test('deserializeGeometry upcasts legacy { points } to one segment', () => {
  expect(deserializeGeometry('{"points":[{"lat":1,"lng":2,"ele":10}],"waypoints":[]}'))
    .toEqual({ segments: [[{ lat: 1, lng: 2, ele: 10 }]], waypoints: [] })
})

test('deserializeGeometry defaults missing arrays to empty', () => {
  expect(deserializeGeometry('{}')).toEqual({ segments: [], waypoints: [] })
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
  expect(t.geometry).toEqual({ segments: [[{ lat: 1, lng: 2, ele: 10 }]], waypoints: [] })
  expect(t.updatedAt).toBe(2000)
})

test('inputToInsertValues serializes geometry and stamps both timestamps', () => {
  const input: NewTrailInput = {
    name: 'A', difficulty: 'easy', description: null,
    metrics: { distanceMeters: 1, elevationGainMeters: 2, elevationLossMeters: 3 },
    geometry: { segments: [], waypoints: [] },
  }
  const v = inputToInsertValues(input, 555)
  expect(v).toEqual({
    name: 'A', difficulty: 'easy',
    distanceMeters: 1, elevationGainMeters: 2, elevationLossMeters: 3,
    description: null, geometry: '{"segments":[],"waypoints":[]}',
    createdAt: 555, updatedAt: 555,
  })
})

test('updateToValues maps editable fields and stamps updatedAt only', () => {
  const update: TrailUpdate = { name: 'Renamed', difficulty: 'medium', description: 'now with notes' }
  const v = updateToValues(update, 999)
  expect(v).toEqual({
    name: 'Renamed', difficulty: 'medium', description: 'now with notes', updatedAt: 999,
  })
})

test('updateToValues carries a null description through', () => {
  const v = updateToValues({ name: 'A', difficulty: 'easy', description: null }, 5)
  expect(v.description).toBeNull()
})

test('updateToValues never emits createdAt, geometry, or metric columns', () => {
  const v = updateToValues({ name: 'A', difficulty: 'hard', description: null }, 5)
  expect(v).not.toHaveProperty('createdAt')
  expect(v).not.toHaveProperty('geometry')
  expect(v).not.toHaveProperty('distanceMeters')
})
