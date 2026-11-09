import type { ActionItem } from '../components/actionItem'

export interface ActivityActionHandlers {
  remove: () => void
}

export function activityActionItems(handlers: ActivityActionHandlers): ActionItem[] {
  return [{ label: 'Delete activity', danger: true, onPress: handlers.remove }]
}
