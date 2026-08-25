import type { OfflinePackInfo } from '../provider/types'
import type { LiveProgress } from './types'
import { packId, parsePackId } from './packId'

export function packIdsForTrail(packs: OfflinePackInfo[], trailId: number): string[] {
  return packs.filter((p) => parsePackId(p.id)?.trailId === trailId).map((p) => p.id)
}

interface RetryTarget {
  id: string
  styleId: string
  // True when a pack for this layer already exists in the registry (resume it); false when the
  // failure left no pack behind — a phantom failed download that must be re-issued from scratch.
  hasPack: boolean
}

// Layers of a trail that need retrying: at-rest error/incomplete packs, plus failed live-progress
// entries (which may have no pack at all — e.g. a download that errored before the pack was created).
export function retryTargetsForTrail(
  packs: OfflinePackInfo[],
  progress: Record<string, LiveProgress>,
  trailId: number,
): RetryTarget[] {
  const registryStyleIds = new Set(
    packs
      .filter((p) => parsePackId(p.id)?.trailId === trailId)
      .map((p) => parsePackId(p.id)!.styleId),
  )
  const styleIds = new Set<string>()
  for (const p of packs) {
    const parsed = parsePackId(p.id)
    if (parsed?.trailId === trailId && (p.state === 'error' || p.state === 'incomplete')) {
      styleIds.add(parsed.styleId)
    }
  }
  for (const [id, prog] of Object.entries(progress)) {
    const parsed = parsePackId(id)
    if (parsed?.trailId === trailId && prog.failed) styleIds.add(parsed.styleId)
  }
  return [...styleIds].map((styleId) => ({
    id: packId(trailId, styleId),
    styleId,
    hasPack: registryStyleIds.has(styleId),
  }))
}
