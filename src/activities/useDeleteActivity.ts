import { useCallback } from 'react'
import { Alert } from 'react-native'
import { useActivitiesStore } from '../store/activitiesStore'
import { useMapStore } from '../store/mapStore'
import { showToast } from '../components/toast'
import { errorClass, logEvent } from '../log'

// The activity's Delete action, the same from the map sheet and the Activities list: confirm,
// remove, and drop it from the map if it was shown.
export function useDeleteActivity(): (activity: { id: number; name: string }) => void {
  const removeActivity = useActivitiesStore((s) => s.removeActivity)
  const forgetEntity = useMapStore((s) => s.forgetEntity)

  return useCallback(
    (activity) => {
      const remove = async () => {
        try {
          await removeActivity(activity.id)
        } catch (error) {
          logEvent('error', 'error', 'deleting the activity failed', { errorClass: errorClass(error) })
          showToast('Could not delete the activity')
          return
        }
        forgetEntity('activity', activity.id)
        showToast('Activity deleted')
      }
      Alert.alert(
        'Delete activity',
        `Are you sure you want to delete "${activity.name}"? This action cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => void remove() },
        ],
      )
    },
    [removeActivity, forgetEntity],
  )
}
