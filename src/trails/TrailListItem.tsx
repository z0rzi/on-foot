import { TrailSummary } from '../data/trails/types'
import { EntityListItem } from '../components/EntityListItem'
import type { MenuAnchor } from '../components/ActionsMenu'
import { TrailSummaryRow } from './TrailSummaryRow'

// A trail's row: in the Trails list with its actions, or compact in a list over the map with its
// completed count.
export function TrailListItem({
  trail,
  onSelect,
  onOpenActions,
  variant,
  completed,
}: {
  trail: TrailSummary
  onSelect: (id: number) => void
  onOpenActions?: (trail: TrailSummary, anchor: MenuAnchor) => void
  variant?: 'card' | 'compact'
  completed?: number
}) {
  return (
    <EntityListItem
      variant={variant}
      title={trail.name}
      summary={<TrailSummaryRow trail={trail} completed={completed} />}
      onPress={() => onSelect(trail.id)}
      pressAccessibilityLabel={`Show ${trail.name} on map`}
      actions={
        onOpenActions && { accessibilityLabel: 'Trail actions', onOpen: (anchor) => onOpenActions(trail, anchor) }
      }
    />
  )
}
