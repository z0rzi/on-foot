import type { OfflinePackInfo } from '../provider/types'
import type { LiveProgress } from './types'
import { packId, packsForTrail } from './packId'

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
  const trailPacks = packsForTrail(packs, trailId)
  const registryStyleIds = new Set(trailPacks.map(({ styleId }) => styleId))
  const styleIds = new Set<string>()
  for (const { pack, styleId } of trailPacks) {
    if (pack.state === 'error' || pack.state === 'incomplete') styleIds.add(styleId)
  }
  for (const { pack, styleId } of packsForTrail(
    Object.entries(progress).map(([id, p]) => ({ id, ...p })),
    trailId,
  )) {
    if (pack.failed) styleIds.add(styleId)
  }
  return [...styleIds].map((styleId) => ({
    id: packId(trailId, styleId),
    styleId,
    hasPack: registryStyleIds.has(styleId),
  }))
}
