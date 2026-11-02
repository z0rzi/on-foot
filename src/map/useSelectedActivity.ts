import { activitiesRepository } from '../data/activities'
import { trailsRepository } from '../data/trails'
import { ActivityWithLinkedTrail, loadActivityWithLinkedTrail } from '../activities/linkedTrail'
import { useActivitiesStore } from '../store/activitiesStore'
import { useTrailsStore } from '../store/trailsStore'
import { useSelectedEntity } from './useSelectedEntity'

const loadActivity = (id: number) =>
  loadActivityWithLinkedTrail(id, activitiesRepository.getActivity, trailsRepository.getTrail)

export function useSelectedActivity(): ActivityWithLinkedTrail | null {
  // The load carries the linked trail, so a trail mutation may change it too. Both counts only
  // grow, so their sum moves whenever either does.
  const version = useActivitiesStore((s) => s.version) + useTrailsStore((s) => s.version)
  return useSelectedEntity('activity', loadActivity, version)
}
