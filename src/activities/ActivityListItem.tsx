import { ActivitySummary } from '../data/activities/types'
import { EntityListItem } from '../components/EntityListItem'
import { EntitySummary } from '../components/EntitySummary'
import type { MenuAnchor } from '../components/ActionsMenu'
import { effortField } from './effort'
import { formatActivityDate, formatActivitySummary } from './format'

export function ActivityListItem({
  activity,
  onSelect,
  onOpenActions,
}: {
  activity: ActivitySummary
  onSelect: (id: number) => void
  onOpenActions: (activity: ActivitySummary, anchor: MenuAnchor) => void
}) {
  return (
    <EntityListItem
      title={activity.name}
      summary={
        <EntitySummary
          badge={{ field: effortField, value: activity.effort }}
          lines={[formatActivitySummary(activity.metrics), formatActivityDate(activity.startedAt)]}
        />
      }
      onPress={() => onSelect(activity.id)}
      pressAccessibilityLabel={`Show ${activity.name} on map`}
      actions={{ accessibilityLabel: 'Activity actions', onOpen: (anchor) => onOpenActions(activity, anchor) }}
    />
  )
}
