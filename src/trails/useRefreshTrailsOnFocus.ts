import { useCallback } from 'react'
import { useFocusEffect } from 'expo-router'
import { useTrailsStore } from '../store/trailsStore'
import { logEvent } from '../log'
import { showToast } from '../components/toast'

// A failed refresh leaves the list on its last known rows, and the toast says they may be stale.
export function useRefreshTrailsOnFocus(): void {
  const loadTrails = useTrailsStore((s) => s.loadTrails)
  useFocusEffect(
    useCallback(() => {
      loadTrails().catch((error) => {
        logEvent('error', 'error', 'refreshing the trails list failed', { error: String(error) })
        showToast('Could not refresh the trails')
      })
    }, [loadTrails]),
  )
}
