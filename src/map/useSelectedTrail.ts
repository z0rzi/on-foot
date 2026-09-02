import { useEffect, useState } from 'react'
import { Trail, trailsRepository } from '../data/trails'
import { useMapStore } from '../store/mapStore'
import { useTrailsStore } from '../store/trailsStore'

export function useSelectedTrail(): Trail | null {
  const selection = useMapStore((s) => s.selection)
  const clearSelection = useMapStore((s) => s.clearSelection)
  const trails = useTrailsStore((s) => s.trails)
  const [trail, setTrail] = useState<Trail | null>(null)
  const trailId = selection?.kind === 'trail' ? selection.id : null

  useEffect(() => {
    if (trailId == null) {
      setTrail(null)
      return
    }
    let active = true
    void trailsRepository.getTrail(trailId).then((loaded) => {
      if (!active) return
      if (loaded == null) clearSelection()
      setTrail(loaded)
    })
    return () => {
      active = false
    }
  }, [trailId, trails, clearSelection])

  return trail
}
