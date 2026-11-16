import { useCallback } from 'react'
import { Alert } from 'react-native'
import { useReturnToMap } from '../components/useReturnToMap'
import { showToast } from '../components/toast'
import { showTrail } from './showTrail'

type ShownTrail = { id: number; name: string }

// Every path that shows a trail on the Map: back to the Map with it shown and framed. While
// recording along another trail it asks before switching. `added` marks a trail just imported, whose
// write is confirmed in the same single toast.
export function useShowTrail(): (trail: ShownTrail, options?: { added?: boolean }) => void {
  const returnToMap = useReturnToMap()

  return useCallback(
    (trail, options) => {
      const added = options?.added === true
      const toast = (along: boolean) => {
        const parts = [added ? 'Trail added' : null, along ? `Along ${trail.name}` : null].filter((p) => p != null)
        if (parts.length > 0) showToast(parts.join(' · '))
      }
      const shown = (along: boolean) => {
        returnToMap()
        toast(along)
      }

      const outcome = showTrail(trail.id)
      if (outcome.kind !== 'differs') {
        shown(outcome.kind === 'along')
        return
      }
      Alert.alert(`Record along ${trail.name} instead of ${outcome.recordedAlong.name}?`, undefined, [
        {
          text: 'Cancel',
          style: 'cancel',
          // The imported trail is saved either way; only the recording's trail stays unchanged.
          onPress: added ? () => shown(false) : undefined,
        },
        { text: 'Switch', onPress: () => shown(showTrail(trail.id, { replaceAlong: true }).kind === 'along') },
      ])
    },
    [returnToMap],
  )
}
