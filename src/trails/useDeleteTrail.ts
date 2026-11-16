import { useCallback } from 'react'
import { Alert } from 'react-native'
import { useOfflineController } from '../map/provider'
import { showToast } from '../components/toast'
import { deleteTrail, TrailDeleted } from './deleteTrail'

// The trail's Delete action, the same from the map sheet and the Trails list: confirm, then delete
// the trail and its offline map.
export function useDeleteTrail(): (trail: { id: number; name: string }) => void {
  const controller = useOfflineController()

  return useCallback(
    (trail) => {
      const remove = async () => {
        let deleted: TrailDeleted
        try {
          deleted = await deleteTrail(controller, trail.id)
        } catch {
          Alert.alert('Could not delete', 'Something went wrong deleting this trail. Please try again.')
          return
        }
        showToast(deleted.wasRecordedAlong ? 'Trail deleted · Recording without a trail' : 'Trail deleted')
      }
      Alert.alert('Delete trail', `Delete "${trail.name}" and its offline map? This cannot be undone.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void remove() },
      ])
    },
    [controller],
  )
}
