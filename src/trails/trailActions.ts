import type { ActionItem } from '../components/actionItem'
import type { GpxPoint } from '../data/trails/types'

export function trailActionItems(
  start: GpxPoint | null,
  offlineItems: ActionItem[],
  navigateTo: (point: GpxPoint) => void,
): ActionItem[] {
  return [
    ...(start ? [{ label: 'Navigate to start', onPress: () => navigateTo(start) }] : []),
    ...offlineItems,
  ]
}
