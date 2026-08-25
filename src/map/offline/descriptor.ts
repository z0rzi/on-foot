import type { StyleDescriptor, OfflinePackDescriptor } from '../provider/types'
import type { LngLatBounds } from './types'
import { packId } from './packId'
import { OFFLINE_MAX_ZOOM, OFFLINE_MIN_ZOOM } from './constants'

// The offline pack a given trail+layer downloads: canonical id, the layer's style url, and the
// trail's corridor bounds at the fixed hiking zoom range. Shared by the chooser and retry.
export function packDescriptor(
  trailId: number,
  style: StyleDescriptor,
  bounds: LngLatBounds,
): OfflinePackDescriptor {
  return {
    id: packId(trailId, style.id),
    styleUrl: style.url,
    bounds: [bounds.ne, bounds.sw],
    minZoom: OFFLINE_MIN_ZOOM,
    maxZoom: OFFLINE_MAX_ZOOM,
  }
}
