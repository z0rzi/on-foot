import { TrailSummary } from '../data/trails/types'
import { formatMetricsSummary } from '../data/geo/metrics'
import { useTheme } from '../theme/useTheme'
import { EntityListItem } from '../components/EntityListItem'
import { EnumBadge } from '../components/EnumBadge'
import { difficultyField } from './difficulty'

export function TrailListItem({
  trail,
  onSelect,
  onEdit,
  onDelete,
}: {
  trail: TrailSummary
  onSelect: (id: number) => void
  onEdit: (id: number) => void
  onDelete: (id: number) => void
}) {
  const c = useTheme()
  return (
    <EntityListItem
      title={trail.name}
      badge={<EnumBadge field={difficultyField} value={trail.difficulty} />}
      lines={[formatMetricsSummary(trail.metrics)]}
      onPress={() => onSelect(trail.id)}
      pressAccessibilityLabel={`Show ${trail.name} on map`}
      actions={[
        {
          accessibilityLabel: 'Edit trail',
          icon: 'create-outline',
          color: c.onSurfaceVariant,
          onPress: () => onEdit(trail.id),
        },
        {
          accessibilityLabel: 'Delete trail',
          icon: 'trash-outline',
          color: c.danger,
          onPress: () => onDelete(trail.id),
        },
      ]}
    />
  )
}
