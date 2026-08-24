import type { OfflinePackInfo } from '../provider/types'
import { parsePackId } from './packId'
import { LiveProgress, OfflineBadgeState } from './types'

export function offlineStateForTrail(
  trailId: number,
  packs: OfflinePackInfo[],
  progress: Record<string, LiveProgress>,
): OfflineBadgeState {
  const liveEntries = Object.entries(progress).filter(([id]) => parsePackId(id)?.trailId === trailId)
  const liveIds = new Set(liveEntries.map(([id]) => id))
  const trailPacks = packs.filter((p) => parsePackId(p.id)?.trailId === trailId)

  // Any failure outranks a download in progress. A live failure, or an at-rest pack that errored
  // or was left 'incomplete' (e.g. a download interrupted by an app kill) with no live tracking,
  // is surfaced as failed so it stays visible and resumable rather than looking un-downloaded.
  const stalled = trailPacks.filter(
    (p) => !liveIds.has(p.id) && (p.state === 'error' || p.state === 'incomplete'),
  )
  if (liveEntries.some(([, p]) => p.failed) || stalled.length) return { kind: 'failed' }

  const active = liveEntries.filter(([, p]) => p.percentage < 100)
  if (active.length) {
    const pct = Math.round(active.reduce((s, [, p]) => s + p.percentage, 0) / active.length)
    return { kind: 'downloading', pct, styleIds: active.map(([id]) => parsePackId(id)!.styleId) }
  }

  const downloading = trailPacks.filter((p) => !liveIds.has(p.id) && p.state === 'downloading')
  if (downloading.length) {
    const pct = Math.round(downloading.reduce((s, p) => s + p.percentage, 0) / downloading.length)
    return { kind: 'downloading', pct, styleIds: downloading.map((p) => parsePackId(p.id)!.styleId) }
  }

  const complete = trailPacks.filter((p) => p.state === 'complete')
  if (complete.length) {
    return { kind: 'available', styleIds: complete.map((p) => parsePackId(p.id)!.styleId) }
  }
  return { kind: 'none' }
}
