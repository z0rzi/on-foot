import { useCallback } from 'react'
import { Alert } from 'react-native'
import { showToast } from '../components/toast'
import { deleteActivity } from './deleteActivity'

// The activity's Delete action, the same from the map sheet and the Activities list: confirm, then
// delete.
export function useDeleteActivity(): (activity: { id: number; name: string }) => void {
  return useCallback((activity) => {
    const remove = async () => {
      try {
        await deleteActivity(activity.id)
      } catch {
        showToast('Could not delete the activity')
        return
      }
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
  }, [])
}
