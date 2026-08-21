import { boundsForPoints, toLineCoordinates, endpointCoordinates } from '../geo'
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

describe('endpointCoordinates', () => {
  test('returns first and last as [lng, lat]', () => {
    expect(endpointCoordinates([p(1, 2), p(3, 4), p(5, 6)])).toEqual([
      [2, 1],
      [6, 5],
    ])
  })
  test('single point -> start equals end', () => {
    expect(endpointCoordinates([p(1, 2)])).toEqual([
      [2, 1],
      [2, 1],
    ])
  })
  test('empty input -> empty array', () => {
    expect(endpointCoordinates([])).toEqual([])
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
