import { useEffect, useState } from 'react'
import { Activity, activitiesRepository } from '../data/activities'
import { useMapStore } from '../store/mapStore'
import { useActivitiesStore } from '../store/activitiesStore'

export function useSelectedActivity(): Activity | null {
  const selection = useMapStore((s) => s.selection)
  const clearSelection = useMapStore((s) => s.clearSelection)
  const activities = useActivitiesStore((s) => s.activities)
  // Keyed to the id it loaded, so a stale result (e.g. mid A→B switch, or after deselect) is
  // derived away during render instead of cleared with a setState-in-effect.
  const [loaded, setLoaded] = useState<{ id: number; activity: Activity | null } | null>(null)
  const activityId = selection?.kind === 'activity' ? selection.id : null

  useEffect(() => {
    if (activityId == null) return
    let active = true
    void activitiesRepository.getActivity(activityId).then((activity) => {
      if (!active) return
      if (activity == null) clearSelection()
      setLoaded({ id: activityId, activity })
    })
    return () => {
      active = false
    }
  }, [activityId, activities, clearSelection])

  return activityId != null && loaded?.id === activityId ? loaded.activity : null
}
