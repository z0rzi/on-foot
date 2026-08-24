import { LayerKind, LngLatBounds, SizeEstimate } from './types'
import { RASTER_BYTES_PER_TILE, VECTOR_BYTES_PER_TILE } from './constants'

export function lngToTileX(lng: number, z: number): number {
  return Math.floor(((lng + 180) / 360) * 2 ** z)
}

export function latToTileY(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z)
}

export function tileCountForBounds(bounds: LngLatBounds, minZoom: number, maxZoom: number): number {
  let count = 0
  for (let z = minZoom; z <= maxZoom; z++) {
    const xMin = lngToTileX(bounds.sw[0], z)
    const xMax = lngToTileX(bounds.ne[0], z)
    // North latitude maps to a smaller tile-Y than south, so ne[1] gives the min row.
    const yMin = latToTileY(bounds.ne[1], z)
    const yMax = latToTileY(bounds.sw[1], z)
    count += (Math.abs(xMax - xMin) + 1) * (Math.abs(yMax - yMin) + 1)
  }
  return count
}

export function estimatePackSize(
  bounds: LngLatBounds,
  minZoom: number,
  maxZoom: number,
  layerKind: LayerKind,
): SizeEstimate {
  const tileCount = tileCountForBounds(bounds, minZoom, maxZoom)
  const bytesPerTile = layerKind === 'raster' ? RASTER_BYTES_PER_TILE : VECTOR_BYTES_PER_TILE
  return { tileCount, bytes: tileCount * bytesPerTile }
}

export function layerKindForStyle(satellite?: boolean): LayerKind {
  return satellite ? 'raster' : 'vector'
}
