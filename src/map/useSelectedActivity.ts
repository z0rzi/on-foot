import { Activity, activitiesRepository } from '../data/activities'
import { useActivitiesStore } from '../store/activitiesStore'
import { useSelectedEntity } from './useSelectedEntity'

const loadActivity = (id: number) => activitiesRepository.getActivity(id)

export function useSelectedActivity(): Activity | null {
  const version = useActivitiesStore((s) => s.version)
  return useSelectedEntity('activity', loadActivity, version)
}
