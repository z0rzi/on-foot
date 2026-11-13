import { simplifyToOverview, storedOverview } from '../overview'

const p = (lat: number, lng: number) => ({ lat, lng })
const parsed = (geometry: string) => JSON.parse(geometry) as { type: string; coordinates: number[][][] }

test('no segments give an empty MultiLineString and no start', () => {
  const overview = simplifyToOverview([])
  expect(parsed(overview.geometry)).toEqual({ type: 'MultiLineString', coordinates: [] })
  expect(overview.start).toBeNull()
})

test('a point within the tolerance of the line is dropped, the endpoints kept as [lng, lat]', () => {
  const overview = simplifyToOverview([[p(45, 6), p(45.00004, 6.005), p(45, 6.01)]])
  expect(parsed(overview.geometry).coordinates).toEqual([[[6, 45], [6.01, 45]]])
})

test('a point beyond the tolerance is kept', () => {
  const overview = simplifyToOverview([[p(45, 6), p(45.00018, 6.005), p(45, 6.01)]])
  expect(parsed(overview.geometry).coordinates).toEqual([[[6, 45], [6.005, 45.00018], [6.01, 45]]])
})

test('segments stay apart, each simplified on its own', () => {
  const overview = simplifyToOverview([
    [p(45, 6), p(45.00001, 6.005), p(45, 6.01)],
    [p(45.1, 6.1), p(45.1, 6.2)],
  ])
  expect(parsed(overview.geometry).coordinates).toEqual([
    [[6, 45], [6.01, 45]],
    [[6.1, 45.1], [6.2, 45.1]],
  ])
})

test('the start is the first position of the first non-empty segment', () => {
  expect(simplifyToOverview([[], [p(45.2, 6.3), p(45.3, 6.4)]]).start).toEqual({ lat: 45.2, lng: 6.3 })
})

test('an empty or single-point segment draws no line, and a lone point is still the start', () => {
  const overview = simplifyToOverview([[], [p(45.2, 6.3)], [p(45.1, 6.1), p(45.1, 6.2)]])
  expect(parsed(overview.geometry).coordinates).toEqual([[[6.1, 45.1], [6.2, 45.1]]])
  expect(overview.start).toEqual({ lat: 45.2, lng: 6.3 })
})

test('positions are rounded to 5 decimals, and a line that rounds to one position is dropped', () => {
  const overview = simplifyToOverview([
    [p(45.123456789, 6.987654321), p(45.2, 6.9)],
    [p(45.000001, 6.000001), p(45.000002, 6.000002)],
  ])
  expect(parsed(overview.geometry).coordinates).toEqual([[[6.98765, 45.12346], [6.9, 45.2]]])
  expect(overview.start).toEqual({ lat: 45.12346, lng: 6.98765 })
})

test('a position that is not a finite number is left out, so the text stays valid GeoJSON', () => {
  const overview = simplifyToOverview([[p(NaN, 6), p(45, 6), p(45, Infinity), p(45, 6.01)]])
  expect(parsed(overview.geometry).coordinates).toEqual([[[6, 45], [6.01, 45]]])
  expect(overview.start).toEqual({ lat: 45, lng: 6 })
})

test('a stored geometry is filled with its overview', () => {
  expect(storedOverview(() => [[p(45, 6), p(45, 6.01)]])).toEqual({
    columns: {
      overviewGeometry: '{"type":"MultiLineString","coordinates":[[[6,45],[6.01,45]]]}',
      startLat: 45, startLng: 6,
    },
    fill: { kind: 'filled' },
  })
})

test('a stored geometry that cannot be read gets an empty overview, so it is not retried', () => {
  const error = new SyntaxError('JSON Parse error')
  expect(storedOverview(() => { throw error })).toEqual({
    columns: { overviewGeometry: '{"type":"MultiLineString","coordinates":[]}', startLat: null, startLng: null },
    fill: { kind: 'unreadable', error },
  })
})
