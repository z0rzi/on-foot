import { useCallback, useState } from 'react'
import type { ActivitySummary } from '../data/activities/types'
import type { MenuAnchor } from '../components/ActionsMenu'

// A list row's ⋮ menu: the activity's summary is all the menu needs, and closing it drops it.
export function useActivityActionsMenu() {
  const [target, setTarget] = useState<{ activity: ActivitySummary; anchor: MenuAnchor } | null>(null)
  const open = useCallback((activity: ActivitySummary, anchor: MenuAnchor) => setTarget({ activity, anchor }), [])
  const closeMenu = useCallback(() => setTarget(null), [])
  return { target, open, closeMenu }
}
