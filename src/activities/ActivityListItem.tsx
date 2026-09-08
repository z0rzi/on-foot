import { ActivitySummary } from '../data/activities/types'
import { useTheme } from '../theme/useTheme'
import { EntityListItem } from '../components/EntityListItem'
import { EnumBadge } from '../components/EnumBadge'
import { effortField } from './effort'
import { formatActivityDate, formatActivitySummary } from './format'

export function ActivityListItem({
  activity,
  onSelect,
  onDelete,
}: {
  activity: ActivitySummary
  onSelect: (id: number) => void
  onDelete: (id: number) => void
}) {
  const c = useTheme()
  return (
    <EntityListItem
      title={activity.name}
      badge={<EnumBadge field={effortField} value={activity.effort} />}
      lines={[formatActivitySummary(activity.metrics), formatActivityDate(activity.startedAt)]}
      onPress={() => onSelect(activity.id)}
      pressAccessibilityLabel={`Show ${activity.name} on map`}
      actions={[
        {
          accessibilityLabel: 'Delete activity',
          icon: 'trash-outline',
          color: c.danger,
          onPress: () => onDelete(activity.id),
        },
      ]}
    />
  )
}
