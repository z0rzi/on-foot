import {
  lngToTileX,
  latToTileY,
  tileCountForBounds,
  estimatePackSize,
  layerKindForStyle,
} from '../estimate'
import { RASTER_BYTES_PER_TILE, VECTOR_BYTES_PER_TILE } from '../constants'
import { LngLatBounds } from '../types'

const world: LngLatBounds = { ne: [179, 85], sw: [-179, -85] }
const tiny: LngLatBounds = { ne: [0.001, 0.001], sw: [-0.001, -0.001] }

describe('slippy-map tile math', () => {
  test('zoom 0 is a single tile', () => {
    expect(lngToTileX(0, 0)).toBe(0)
    expect(latToTileY(0, 0)).toBe(0)
    expect(tileCountForBounds(world, 0, 0)).toBe(1)
  })
  test('a sub-tile bbox is one tile at a high zoom', () => {
    expect(tileCountForBounds(tiny, 14, 14)).toBe(4)
  })
  test('tile count grows with the zoom range', () => {
    const narrow = tileCountForBounds(tiny, 10, 12)
    const wide = tileCountForBounds(tiny, 10, 16)
    expect(wide).toBeGreaterThan(narrow)
  })
})

describe('estimatePackSize', () => {
  test('bytes = tileCount × per-tile constant for the layer kind', () => {
    const vector = estimatePackSize(tiny, 10, 16, 'vector')
    expect(vector.bytes).toBe(vector.tileCount * VECTOR_BYTES_PER_TILE)
  })
  test('raster (satellite) estimates larger than vector for the same area', () => {
    const v = estimatePackSize(tiny, 10, 16, 'vector')
    const r = estimatePackSize(tiny, 10, 16, 'raster')
    expect(r.bytes).toBeGreaterThan(v.bytes)
    expect(r.bytes).toBe(r.tileCount * RASTER_BYTES_PER_TILE)
  })
})

describe('layerKindForStyle', () => {
  test('satellite flag → raster', () => expect(layerKindForStyle(true)).toBe('raster'))
  test('absent/false → vector', () => {
    expect(layerKindForStyle(false)).toBe('vector')
    expect(layerKindForStyle(undefined)).toBe('vector')
  })
})
