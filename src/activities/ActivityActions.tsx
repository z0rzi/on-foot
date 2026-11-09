import { ActionsMenu, type MenuAnchor } from '../components/ActionsMenu'
import { activityActionItems } from './activityActions'
import { useDeleteActivity } from './useDeleteActivity'

// The activity's ⋮ menu, the same in the map sheet and the Activities list.
export function ActivityActions({
  activity,
  anchor,
  onCloseMenu,
}: {
  activity: { id: number; name: string }
  anchor: MenuAnchor | null
  onCloseMenu: () => void
}) {
  const deleteActivity = useDeleteActivity()
  if (!anchor) return null
  return (
    <ActionsMenu
      items={activityActionItems({ remove: () => deleteActivity(activity) })}
      anchor={anchor}
      onClose={onCloseMenu}
    />
  )
}
