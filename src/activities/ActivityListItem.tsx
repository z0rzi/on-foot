import { ActivitySummary } from '../data/activities/types'
import { EntityListItem } from '../components/EntityListItem'
import { EntitySummary } from '../components/EntitySummary'
import type { MenuAnchor } from '../components/ActionsMenu'
import { formatDuration } from '../format/units'
import { effortField } from './effort'
import { formatActivityDate, formatActivitySummary } from './format'

// An activity's row: in the Activities list with its actions, or compact in a list over the map. In
// its trail's family the distance is the trail's, so the row gives the date and the duration.
export function ActivityListItem({
  activity,
  onSelect,
  onOpenActions,
  variant,
  selected,
  inFamily = false,
}: {
  activity: ActivitySummary
  onSelect: (id: number) => void
  onOpenActions?: (activity: ActivitySummary, anchor: MenuAnchor) => void
  variant?: 'card' | 'compact'
  selected?: boolean
  inFamily?: boolean
}) {
  const date = formatActivityDate(activity.startedAt)
  const lines: [string, ...string[]] = inFamily
    ? [`${date} · ${formatDuration(activity.metrics.durationSeconds)}`]
    : [formatActivitySummary(activity.metrics), date]
  return (
    <EntityListItem
      variant={variant}
      selected={selected}
      title={activity.name}
      summary={<EntitySummary badge={{ field: effortField, value: activity.effort }} lines={lines} />}
      onPress={() => onSelect(activity.id)}
      pressAccessibilityLabel={`Show ${activity.name} on map`}
      actions={
        onOpenActions && { accessibilityLabel: 'Activity actions', onOpen: (anchor) => onOpenActions(activity, anchor) }
      }
    />
  )
}
