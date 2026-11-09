import { useCallback } from 'react'
import { Alert } from 'react-native'
import { useTrailsStore } from '../store/trailsStore'
import { useMapStore } from '../store/mapStore'
import { useOfflineController } from '../map/provider'
import { useOfflineStore } from '../map/offline/offlineStore'
import { showToast } from '../components/toast'
import { logEvent } from '../log'
import { currentAlongTrailId } from '../recording/currentAlongTrail'

// The trail's Delete action, the same from the map sheet and the Trails list: confirm, remove its
// offline map then the trail, and drop it from the map if it was shown. The recording's trail goes
// too: the recording carries on along no trail.
export function useDeleteTrail(): (trail: { id: number; name: string }) => void {
  const controller = useOfflineController()
  const removeForTrail = useOfflineStore((s) => s.removeForTrail)
  const removeTrail = useTrailsStore((s) => s.removeTrail)
  const forgetEntity = useMapStore((s) => s.forgetEntity)

  return useCallback(
    (trail) => {
      const remove = async () => {
        try {
          await removeForTrail(controller, trail.id)
          await removeTrail(trail.id)
        } catch (error) {
          logEvent('error', 'error', 'deleting the trail failed', { error: String(error) })
          Alert.alert('Could not delete', 'Something went wrong deleting this trail. Please try again.')
          return
        }
        const wasAlong = currentAlongTrailId() === trail.id
        forgetEntity('trail', trail.id)
        showToast(wasAlong ? 'Trail deleted · Recording without a trail' : 'Trail deleted')
      }
      Alert.alert('Delete trail', `Delete "${trail.name}" and its offline map? This cannot be undone.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void remove() },
      ])
    },
    [controller, removeForTrail, removeTrail, forgetEntity],
  )
}
