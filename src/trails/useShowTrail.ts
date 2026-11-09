import { useCallback } from 'react'
import { Alert } from 'react-native'
import { useMapStore } from '../store/mapStore'
import { useTrailsStore } from '../store/trailsStore'
import { currentRecordingPhase } from '../recording/recordingStore'
import { selectTrailWhileRecording } from '../recording/alongTrail'
import { currentAlongTrailId } from '../recording/currentAlongTrail'
import { useReturnToMap } from '../components/useReturnToMap'
import { showToast } from '../components/toast'

type ShownTrail = { id: number; name: string }

// Every path that shows a trail on the Map: back to the Map with it shown and framed. While
// recording it is the recording's trail, so changing it from another trail asks first. `added`
// marks a trail just imported, whose write is confirmed in the same single toast.
export function useShowTrail(): (trail: ShownTrail, options?: { added?: boolean }) => void {
  const select = useMapStore((s) => s.select)
  const returnToMap = useReturnToMap()

  return useCallback(
    (trail, options) => {
      const added = options?.added === true
      const toast = (along: boolean) => {
        const parts = [added ? 'Trail added' : null, along ? `Along ${trail.name}` : null].filter((p) => p != null)
        if (parts.length > 0) showToast(parts.join(' · '))
      }
      const show = (along: boolean) => {
        select('trail', trail.id)
        returnToMap()
        toast(along)
      }

      if (currentRecordingPhase() === 'idle') {
        show(false)
        return
      }
      // A selection whose trail is no longer in the list is a trail gone from under the map, which
      // is cleared on its own: the recording is along no trail.
      const currentId = currentAlongTrailId()
      const current = useTrailsStore.getState().trails.find((t) => t.id === currentId) ?? null
      const outcome = selectTrailWhileRecording(current?.id ?? null, trail.id)
      if (outcome !== 'ask' || current == null) {
        show(outcome === 'along')
        return
      }
      Alert.alert(`Record along ${trail.name} instead of ${current.name}?`, undefined, [
        {
          text: 'Cancel',
          style: 'cancel',
          // The imported trail is saved either way; only the recording's trail stays unchanged.
          onPress: added
            ? () => {
                returnToMap()
                toast(false)
              }
            : undefined,
        },
        { text: 'Switch', onPress: () => show(true) },
      ])
    },
    [select, returnToMap],
  )
}
