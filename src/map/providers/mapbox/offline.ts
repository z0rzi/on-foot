import Mapbox from '@rnmapbox/maps'
import type { OfflineController, OfflinePackDescriptor, OfflinePackInfo } from '../../provider/types'

// The native `state` field differs by platform: Android sends the string enum rawValue
// ("complete"/"active"/"inactive"/…), iOS may send the numeric 0/1/2. Match both. The Android
// getPacks payload also omits `completedTileSize` and can send a null `percentage` — callers
// coalesce those before mapping (see infoFromPack / subscribe).
export function mapPackState(state: number | string, percentage: number): OfflinePackInfo['state'] {
  if (percentage >= 100 || state === 2 || state === 'complete') return 'complete'
  if (state === 1 || state === 'active') return 'downloading'
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
  const percentage = status.percentage ?? 0
  return {
    id: pack.name,
    meta: toMeta(pack.metadata),
    state: mapPackState(status.state, percentage),
    percentage,
    sizeBytes: status.completedTileSize ?? status.completedResourceSize ?? 0,
  }
}

export const mapboxOfflineController: OfflineController = {
  async downloadPack(d: OfflinePackDescriptor) {
    await Mapbox.offlineManager.deletePack(d.id).catch(() => {})
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
      (_pack, status) => {
        const percentage = status.percentage ?? 0
        onProgress({
          id,
          meta: null,
          state: mapPackState(status.state, percentage),
          percentage,
          sizeBytes: status.completedTileSize ?? status.completedResourceSize ?? 0,
        })
      },
      (_pack, err) => onError(id, err.message),
    )
    return () => Mapbox.offlineManager.unsubscribe(id)
  },
}
