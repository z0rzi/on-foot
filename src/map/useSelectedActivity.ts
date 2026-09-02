import { useEffect, useState } from 'react'
import { Activity, activitiesRepository } from '../data/activities'
import { useMapStore } from '../store/mapStore'
import { useActivitiesStore } from '../store/activitiesStore'

export function useSelectedActivity(): Activity | null {
  const selection = useMapStore((s) => s.selection)
  const clearSelection = useMapStore((s) => s.clearSelection)
  const activities = useActivitiesStore((s) => s.activities)
  const [activity, setActivity] = useState<Activity | null>(null)
  const activityId = selection?.kind === 'activity' ? selection.id : null

  useEffect(() => {
    if (activityId == null) {
      setActivity(null)
      return
    }
    let active = true
    void activitiesRepository.getActivity(activityId).then((loaded) => {
      if (!active) return
      if (loaded == null) clearSelection()
      setActivity(loaded)
    })
    return () => {
      active = false
    }
  }, [activityId, activities, clearSelection])

  return activity
}
