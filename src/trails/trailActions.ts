import type { ActionItem } from '../components/actionItem'
import type { GpxPoint } from '../data/trails/types'
import { offlineMenuItems, type OfflineMenuAction } from '../map/offline/menu'
import type { TrailOfflineStatus } from '../map/offline/types'

export interface TrailActionHandlers {
  navigateTo: (point: GpxPoint) => void
  offline: Record<OfflineMenuAction, () => void>
  edit: () => void
  remove: () => void
}

export function trailActionItems(
  start: GpxPoint | null,
  offline: TrailOfflineStatus,
  handlers: TrailActionHandlers,
): ActionItem[] {
  return [
    ...(start ? [{ label: 'Navigate to start', onPress: () => handlers.navigateTo(start) }] : []),
    ...offlineMenuItems(offline).map(({ label, danger, action }) => ({ label, danger, onPress: handlers.offline[action] })),
    { label: 'Edit trail', onPress: handlers.edit },
    { label: 'Delete trail', danger: true, onPress: handlers.remove },
  ]
}
