import type { OfflineController, OfflinePackInfo } from '../provider/types'
import { parsePackId } from './packId'

export function packIdsForTrail(packs: OfflinePackInfo[], trailId: number): string[] {
  return packs.filter((p) => parsePackId(p.id)?.trailId === trailId).map((p) => p.id)
}

export async function removeAllPacksForTrail(
  controller: OfflineController,
  trailId: number,
): Promise<void> {
  const packs = await controller.listPacks()
  await Promise.all(packIdsForTrail(packs, trailId).map((id) => controller.deletePack(id)))
}
