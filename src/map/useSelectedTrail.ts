import { useEffect, useState } from 'react'
import { Trail, trailsRepository } from '../data/trails'
import { useMapStore } from '../store/mapStore'
import { useTrailsStore } from '../store/trailsStore'

export function useSelectedTrail(): Trail | null {
  const selection = useMapStore((s) => s.selection)
  const clearSelection = useMapStore((s) => s.clearSelection)
  const trails = useTrailsStore((s) => s.trails)
  // Keyed to the id it loaded, so a stale result (e.g. mid A→B switch, or after deselect) is
  // derived away during render instead of cleared with a setState-in-effect.
  const [loaded, setLoaded] = useState<{ id: number; trail: Trail | null } | null>(null)
  const trailId = selection?.kind === 'trail' ? selection.id : null

  useEffect(() => {
    if (trailId == null) return
    let active = true
    void trailsRepository.getTrail(trailId).then((trail) => {
      if (!active) return
      if (trail == null) clearSelection()
      setLoaded({ id: trailId, trail })
    })
    return () => {
      active = false
    }
  }, [trailId, trails, clearSelection])

  return trailId != null && loaded?.id === trailId ? loaded.trail : null
}
