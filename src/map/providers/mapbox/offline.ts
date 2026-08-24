import Mapbox from '@rnmapbox/maps'
import type { OfflineController, OfflinePackDescriptor, OfflinePackInfo } from '../../provider/types'

export function mapPackState(state: number, percentage: number): OfflinePackInfo['state'] {
  if (state === 2 || percentage >= 100) return 'complete'
  if (state === 1) return 'downloading'
  return 'incomplete'
}

function toMeta(raw: unknown): OfflinePackInfo['meta'] {
  const m = raw as { trailId?: unknown; styleId?: unknown } | null | undefined
  return m && typeof m.trailId === 'number' && typeof m.styleId === 'string'
    ? { trailId: m.trailId, styleId: m.styleId }
    : null
}

type MapboxOfflinePack = Awaited<ReturnType<typeof Mapbox.offlineManager.getPacks>>[number]

async function infoFromPack(pack: MapboxOfflinePack): Promise<OfflinePackInfo> {
  const status = await pack.status()
  return {
    id: pack.name,
    meta: toMeta(pack.metadata),
    state: mapPackState(status.state, status.percentage),
    percentage: status.percentage,
    sizeBytes: status.completedTileSize ?? 0,
  }
}

export const mapboxOfflineController: OfflineController = {
  async downloadPack(d: OfflinePackDescriptor) {
    await Mapbox.offlineManager.createPack(
      {
        name: d.id,
        styleURL: d.styleUrl,
        bounds: d.bounds,
        minZoom: d.minZoom,
        maxZoom: d.maxZoom,
        metadata: d.meta,
      },
      () => {},
      () => {},
    )
  },
  async deletePack(id: string) {
    await Mapbox.offlineManager.deletePack(id)
  },
  async resumePack(id: string) {
    const pack = await Mapbox.offlineManager.getPack(id)
    await pack?.resume()
  },
  async listPacks() {
    const packs = await Mapbox.offlineManager.getPacks()
    return Promise.all(packs.map(infoFromPack))
  },
  subscribe(id, onProgress, onError) {
    Mapbox.offlineManager.subscribe(
      id,
      (_pack, status) =>
        onProgress({
          id,
          meta: null,
          state: mapPackState(status.state, status.percentage),
          percentage: status.percentage,
          sizeBytes: status.completedTileSize ?? 0,
        }),
      (_pack, err) => onError(id, err.message),
    )
    return () => Mapbox.offlineManager.unsubscribe(id)
  },
}
