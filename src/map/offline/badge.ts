import type { OfflinePackInfo } from '../provider/types'
import { parsePackId } from './packId'
import { LiveProgress, OfflineBadgeState } from './types'

export function offlineStateForTrail(
  trailId: number,
  packs: OfflinePackInfo[],
  progress: Record<string, LiveProgress>,
): OfflineBadgeState {
  const live = Object.entries(progress)
    .filter(([id]) => parsePackId(id)?.trailId === trailId)
    .map(([, p]) => p)
  const trailPacks = packs.filter((p) => parsePackId(p.id)?.trailId === trailId)

  if (live.some((p) => p.failed) || trailPacks.some((p) => p.state === 'error')) {
    return { kind: 'failed' }
  }

  const active = live.filter((p) => p.percentage < 100)
  if (active.length) {
    const pct = Math.round(active.reduce((s, p) => s + p.percentage, 0) / active.length)
    return { kind: 'downloading', pct }
  }

  const downloading = trailPacks.filter((p) => p.state === 'downloading')
  if (downloading.length) {
    const pct = Math.round(downloading.reduce((s, p) => s + p.percentage, 0) / downloading.length)
    return { kind: 'downloading', pct }
  }
  const complete = trailPacks.filter((p) => p.state === 'complete')
  if (complete.length) {
    return { kind: 'available', styleIds: complete.map((p) => parsePackId(p.id)!.styleId) }
  }
  return { kind: 'none' }
}
