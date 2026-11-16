import { useCallback } from 'react'
import { useActivitiesStore } from '../src/store/activitiesStore'
import { showActivity } from '../src/activities/showActivity'
import { ActivityListItem } from '../src/activities/ActivityListItem'
import { ListScreen } from '../src/components/ListScreen'
import { useReturnToMap } from '../src/components/useReturnToMap'
import { showToast } from '../src/components/toast'
import { useRefreshOnFocus } from '../src/components/useRefreshOnFocus'
import { ACTIVITIES_REFRESH_FAILURE } from '../src/activities/refreshFailure'
import { ActivityActions } from '../src/activities/ActivityActions'
import { useActivityActionsMenu } from '../src/activities/useActivityActionsMenu'

export default function ActivitiesScreen() {
  const returnToMap = useReturnToMap()
  const activities = useActivitiesStore((s) => s.activities)
  const loadActivities = useActivitiesStore((s) => s.loadActivities)
  const actions = useActivityActionsMenu()

  useRefreshOnFocus(loadActivities, ACTIVITIES_REFRESH_FAILURE)

  const onSelect = useCallback(
    (id: number) => {
      if (showActivity(id).kind === 'refused-recording') {
        showToast('Finish the recording to open an activity')
        return
      }
      returnToMap()
    },
    [returnToMap],
  )

  return (
    <>
      <ListScreen
        items={activities}
        keyOf={(a) => String(a.id)}
        emptyMessage="No activities yet. Start a recording from the map."
        renderItem={(activity) => (
          <ActivityListItem activity={activity} onSelect={onSelect} onOpenActions={actions.open} />
        )}
      />
      {actions.target && (
        <ActivityActions activity={actions.target.activity} anchor={actions.target.anchor} onCloseMenu={actions.closeMenu} />
      )}
    </>
  )
}
