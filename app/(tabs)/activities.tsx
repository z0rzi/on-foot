import { useCallback } from 'react'
import { Alert } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { useActivitiesStore } from '../../src/store/activitiesStore'
import { useMapStore } from '../../src/store/mapStore'
import { useRecordingStore, recordingPhase } from '../../src/recording/recordingStore'
import { ActivityListItem } from '../../src/activities/ActivityListItem'
import { ListScreen } from '../../src/components/ListScreen'
import { ActivitySummary } from '../../src/data/activities/types'

export default function ActivitiesScreen() {
  const router = useRouter()
  const activities = useActivitiesStore((s) => s.activities)
  const loadActivities = useActivitiesStore((s) => s.loadActivities)
  const removeActivity = useActivitiesStore((s) => s.removeActivity)
  const select = useMapStore((s) => s.select)

  useFocusEffect(useCallback(() => { void loadActivities() }, [loadActivities]))

  const onSelect = useCallback(
    (id: number) => {
      if (recordingPhase(useRecordingStore.getState().session) !== 'idle') return
      select('activity', id)
      router.navigate('/')
    },
    [select, router],
  )

  const confirmDelete = useCallback(
    (activity: ActivitySummary) => {
      Alert.alert(
        'Delete Activity',
        `Are you sure you want to delete "${activity.name}"? This action cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              void removeActivity(activity.id)
            },
          },
        ],
      )
    },
    [removeActivity],
  )

  return (
    <ListScreen
      title="Activities"
      items={activities}
      keyOf={(a) => String(a.id)}
      emptyMessage="No activities recorded yet."
      renderItem={(activity) => (
        <ActivityListItem activity={activity} onSelect={onSelect} onDelete={() => confirmDelete(activity)} />
      )}
    />
  )
}
