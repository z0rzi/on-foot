import {
  boundsForPoints,
  toLineCoordinates,
  segmentLines,
  connectorLines,
  overallEndpoints,
  flattenSegments,
  startPointOf,
} from '../geo'
import { GpxPoint } from '../../data/trails/types'

const p = (lat: number, lng: number): GpxPoint => ({ lat, lng, ele: null })

describe('toLineCoordinates', () => {
  test('maps points to [lng, lat] pairs in order', () => {
    expect(toLineCoordinates([p(1, 2), p(3, 4)])).toEqual([
      [2, 1],
      [4, 3],
    ])
  })
  test('empty input -> empty array', () => {
    expect(toLineCoordinates([])).toEqual([])
  })
})

describe('boundsForPoints', () => {
  test('computes ne (max) and sw (min) across points', () => {
    expect(boundsForPoints([p(1, 2), p(5, -3), p(3, 4)])).toEqual({
      ne: [4, 5],
      sw: [-3, 1],
    })
  })
  test('single point -> ne equals sw', () => {
    expect(boundsForPoints([p(1, 2)])).toEqual({ ne: [2, 1], sw: [2, 1] })
  })
  test('empty input -> null', () => {
    expect(boundsForPoints([])).toBeNull()
  })
})

describe('segment helpers', () => {
  const segA = [p(1, 1), p(1, 2), p(1, 3)]
  const segB = [p(2, 5), p(2, 6)]

  test('segmentLines maps each ≥2-point segment to a line, drops shorter ones', () => {
    expect(segmentLines([segA, [p(9, 9)], segB])).toEqual([
      [[1, 1], [2, 1], [3, 1]],
      [[5, 2], [6, 2]],
    ])
  })
  test('connectorLines joins last-of-prev to first-of-next across non-empty segments', () => {
    expect(connectorLines([segA, segB])).toEqual([[[3, 1], [5, 2]]])
  })
  test('connectorLines is empty for a single segment', () => {
    expect(connectorLines([segA])).toEqual([])
  })
  test('connectorLines skips empty segments', () => {
    expect(connectorLines([segA, [], segB])).toEqual([[[3, 1], [5, 2]]])
  })
  test('overallEndpoints returns first-of-first and last-of-last non-empty', () => {
    expect(overallEndpoints([[], segA, segB])).toEqual([[1, 1], [6, 2]])
  })
  test('overallEndpoints of all-empty is empty', () => {
    expect(overallEndpoints([[], []])).toEqual([])
  })
  test('flattenSegments concatenates in order', () => {
    expect(flattenSegments([segA, segB])).toHaveLength(5)
  })
})

describe('startPointOf', () => {
  test('no segments -> null', () => {
    expect(startPointOf([])).toBeNull()
  })
  test('only empty segments -> null', () => {
    expect(startPointOf([[], []])).toBeNull()
  })
  test('skips a leading empty segment', () => {
    expect(startPointOf([[], [p(45, 6), p(46, 7)]])).toEqual(p(45, 6))
  })
  test('returns the first point of the first non-empty segment, lat and lng unswapped', () => {
    const start = startPointOf([[p(45.5, 6.25), p(46, 7)], [p(47, 8)]])
    expect(start).toEqual({ lat: 45.5, lng: 6.25, ele: null })
  })
})
