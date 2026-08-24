import type { OfflinePackInfo } from '../provider/types'
import { parsePackId } from './packId'
import { OfflineLayerRow, OfflineTrailGroup } from './types'

export function groupPacksByTrail(
  packs: OfflinePackInfo[],
  trails: { id: number; name: string }[],
): OfflineTrailGroup[] {
  const byTrail = new Map<number, OfflineLayerRow[]>()
  for (const p of packs) {
    const parsed = parsePackId(p.id)
    if (!parsed) continue
    const rows = byTrail.get(parsed.trailId) ?? []
    rows.push({ styleId: parsed.styleId, sizeBytes: p.sizeBytes })
    byTrail.set(parsed.trailId, rows)
  }
  const nameOf = new Map(trails.map((t) => [t.id, t.name]))
  return [...byTrail.entries()].map(([trailId, layers]) => ({
    trailId,
    trailName: nameOf.get(trailId) ?? null,
    layers,
    totalBytes: layers.reduce((sum, l) => sum + l.sizeBytes, 0),
  }))
}

export function totalOfflineBytes(packs: OfflinePackInfo[]): number {
  return packs.reduce((sum, p) => sum + p.sizeBytes, 0)
}
