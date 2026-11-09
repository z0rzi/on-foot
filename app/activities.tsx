import { useCallback, useState } from 'react'
import { useActivitiesStore } from '../src/store/activitiesStore'
import { useMapStore } from '../src/store/mapStore'
import { currentRecordingPhase } from '../src/recording/recordingStore'
import { ActivityListItem } from '../src/activities/ActivityListItem'
import { ListScreen } from '../src/components/ListScreen'
import { ActivitySummary } from '../src/data/activities/types'
import { logEvent } from '../src/log'
import { useReturnToMap } from '../src/components/useReturnToMap'
import { showToast } from '../src/components/toast'
import { useRefreshOnFocus } from '../src/components/useRefreshOnFocus'
import type { MenuAnchor } from '../src/components/ActionsMenu'
import { ActivityActions } from '../src/activities/ActivityActions'

export default function ActivitiesScreen() {
  const returnToMap = useReturnToMap()
  const activities = useActivitiesStore((s) => s.activities)
  const loadActivities = useActivitiesStore((s) => s.loadActivities)
  const [menu, setMenu] = useState<{ activity: ActivitySummary; anchor: MenuAnchor } | null>(null)
  const select = useMapStore((s) => s.select)

  useRefreshOnFocus(loadActivities, {
    logMessage: 'refreshing the activities list failed',
    toast: 'Could not refresh the activities',
  })

  const onSelect = useCallback(
    (id: number) => {
      if (currentRecordingPhase() !== 'idle') {
        logEvent('warn', 'error', 'refused opening an activity while recording')
        showToast('Finish the recording to open an activity')
        return
      }
      select('activity', id)
      returnToMap()
    },
    [select, returnToMap],
  )

  return (
    <>
      <ListScreen
        items={activities}
        keyOf={(a) => String(a.id)}
        emptyMessage="No activities yet. Start a recording from the map."
        renderItem={(activity) => (
          <ActivityListItem
            activity={activity}
            onSelect={onSelect}
            onOpenActions={(target, anchor) => setMenu({ activity: target, anchor })}
          />
        )}
      />
      {menu && <ActivityActions activity={menu.activity} anchor={menu.anchor} onCloseMenu={() => setMenu(null)} />}
    </>
  )
}
