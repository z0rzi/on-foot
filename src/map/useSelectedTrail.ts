import { Trail, trailsRepository } from '../data/trails'
import { useTrailsStore } from '../store/trailsStore'
import { useSelectedEntity } from './useSelectedEntity'

const loadTrail = (id: number) => trailsRepository.getTrail(id)

export function useSelectedTrail(): Trail | null {
  const version = useTrailsStore((s) => s.version)
  return useSelectedEntity('trail', loadTrail, version)
}
