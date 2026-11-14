import { useCallback, useState } from 'react'
import { useTrailsStore } from '../store/trailsStore'
import type { Trail, TrailSummary } from '../data/trails/types'
import type { MenuAnchor } from '../components/ActionsMenu'
import { showToast } from '../components/toast'
import { errorClass, logEvent } from '../log'

const LOAD_FAILURE_TOAST = 'Could not open the trail'

// A list row holds only the trail's summary, and its ⋮ menu needs the whole trail (start point,
// bounds for the offline map), so opening the menu reads the trail first. The trail stays the
// target once the menu closes, so the offline layer chooser it opened keeps its trail, and is
// dropped once the trail leaves the list.
export function useTrailActionsMenu(trails: TrailSummary[]) {
  const [target, setTarget] = useState<{ trail: Trail; anchor: MenuAnchor | null } | null>(null)

  const open = useCallback((summary: TrailSummary, anchor: MenuAnchor) => {
    void useTrailsStore.getState().getTrail(summary.id).then(
      (trail) => {
        if (trail == null) {
          logEvent('warn', 'error', 'trail not found for its actions menu', { id: summary.id })
          showToast(LOAD_FAILURE_TOAST)
          return
        }
        setTarget({ trail, anchor })
      },
      (error: unknown) => {
        logEvent('error', 'error', 'loading the trail for its actions menu failed', { id: summary.id, errorClass: errorClass(error) })
        showToast(LOAD_FAILURE_TOAST)
      },
    )
  }, [])

  const closeMenu = useCallback(() => setTarget((t) => t && { ...t, anchor: null }), [])

  const listed = target != null && trails.some((t) => t.id === target.trail.id)
  return { target: listed ? target : null, open, closeMenu }
}
