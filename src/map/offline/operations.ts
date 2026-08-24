import type { OfflinePackInfo } from '../provider/types'
import { parsePackId } from './packId'

export function packIdsForTrail(packs: OfflinePackInfo[], trailId: number): string[] {
  return packs.filter((p) => parsePackId(p.id)?.trailId === trailId).map((p) => p.id)
}
