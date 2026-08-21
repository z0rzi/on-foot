import { useEffect, useState } from 'react'
import { Trail, trailsRepository } from '../data/trails'
import { useMapStore } from '../store/mapStore'
import { useTrailsStore } from '../store/trailsStore'

export function useSelectedTrail(): Trail | null {
  const selectedTrailId = useMapStore((s) => s.selectedTrailId)
  const trails = useTrailsStore((s) => s.trails)
  const [trail, setTrail] = useState<Trail | null>(null)

  useEffect(() => {
    if (selectedTrailId == null) {
      setTrail(null)
      return
    }
    let active = true
    trailsRepository.getTrail(selectedTrailId).then((loaded) => {
      if (active) setTrail(loaded)
    })
    return () => {
      active = false
    }
  }, [selectedTrailId, trails])

  return trail
}
