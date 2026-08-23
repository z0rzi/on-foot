import { useEffect, useState } from 'react'
import { Activity, activitiesRepository } from '../data/activities'
import { useMapStore } from '../store/mapStore'
import { useActivitiesStore } from '../store/activitiesStore'

export function useSelectedActivity(): Activity | null {
  const selectedActivityId = useMapStore((s) => s.selectedActivityId)
  const clearSelectedActivity = useMapStore((s) => s.clearSelectedActivity)
  const activities = useActivitiesStore((s) => s.activities)
  const [activity, setActivity] = useState<Activity | null>(null)

  useEffect(() => {
    if (selectedActivityId == null) {
      setActivity(null)
      return
    }
    let active = true
    activitiesRepository.getActivity(selectedActivityId).then((loaded) => {
      if (!active) return
      if (loaded == null) clearSelectedActivity()
      setActivity(loaded)
    })
    return () => {
      active = false
    }
  }, [selectedActivityId, activities, clearSelectedActivity])

  return activity
}
