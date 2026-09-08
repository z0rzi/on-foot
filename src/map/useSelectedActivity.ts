import { Activity, activitiesRepository } from '../data/activities'
import { useActivitiesStore } from '../store/activitiesStore'
import { useSelectedEntity } from './useSelectedEntity'

const loadActivity = (id: number) => activitiesRepository.getActivity(id)

export function useSelectedActivity(): Activity | null {
  const activities = useActivitiesStore((s) => s.activities)
  return useSelectedEntity('activity', loadActivity, activities)
}
