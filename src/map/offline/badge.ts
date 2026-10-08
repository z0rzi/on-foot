import type { OfflinePackInfo } from '../provider/types'
import { packsForTrail } from './packId'
import { LiveProgress, OfflineBadgeState } from './types'

export function offlineStateForTrail(
  trailId: number,
  packs: OfflinePackInfo[],
  progress: Record<string, LiveProgress>,
): OfflineBadgeState {
  const live = packsForTrail(
    Object.entries(progress).map(([id, p]) => ({ id, ...p })),
    trailId,
  )
  const liveIds = new Set(live.map(({ pack }) => pack.id))
  const trailPacks = packsForTrail(packs, trailId)

  // Any failure outranks a download in progress. A live failure, or an at-rest pack that errored
  // or was left 'incomplete' (e.g. a download interrupted by an app kill) with no live tracking,
  // is surfaced as failed so it stays visible and resumable rather than looking un-downloaded.
  const stalled = trailPacks.filter(
    ({ pack }) => !liveIds.has(pack.id) && (pack.state === 'error' || pack.state === 'incomplete'),
  )
  if (live.some(({ pack }) => pack.failed) || stalled.length) return { kind: 'failed' }

  const active = live.filter(({ pack }) => pack.percentage < 100)
  if (active.length) {
    const pct = Math.round(active.reduce((s, { pack }) => s + pack.percentage, 0) / active.length)
    return { kind: 'downloading', pct, styleIds: active.map(({ styleId }) => styleId) }
  }

  const downloading = trailPacks.filter(
    ({ pack }) => !liveIds.has(pack.id) && pack.state === 'downloading',
  )
  if (downloading.length) {
    const pct = Math.round(
      downloading.reduce((s, { pack }) => s + pack.percentage, 0) / downloading.length,
    )
    return { kind: 'downloading', pct, styleIds: downloading.map(({ styleId }) => styleId) }
  }

  const complete = trailPacks.filter(({ pack }) => pack.state === 'complete')
  if (complete.length) {
    return { kind: 'available', styleIds: complete.map(({ styleId }) => styleId) }
  }
  return { kind: 'none' }
}
