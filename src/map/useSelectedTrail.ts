import { Trail, trailsRepository } from '../data/trails'
import { useTrailsStore } from '../store/trailsStore'
import { useSelectedEntity } from './useSelectedEntity'

const loadTrail = (id: number) => trailsRepository.getTrail(id)

export function useSelectedTrail(): Trail | null {
  const trails = useTrailsStore((s) => s.trails)
  return useSelectedEntity('trail', loadTrail, trails)
}
