import { TrailSummary } from '../data/trails/types'
import { EntityListItem } from '../components/EntityListItem'
import type { MenuAnchor } from '../components/ActionsMenu'
import { TrailSummaryRow } from './TrailSummaryRow'

export function TrailListItem({
  trail,
  onSelect,
  onOpenActions,
}: {
  trail: TrailSummary
  onSelect: (id: number) => void
  onOpenActions: (trail: TrailSummary, anchor: MenuAnchor) => void
}) {
  return (
    <EntityListItem
      title={trail.name}
      summary={<TrailSummaryRow trail={trail} />}
      onPress={() => onSelect(trail.id)}
      pressAccessibilityLabel={`Show ${trail.name} on map`}
      actions={{ accessibilityLabel: 'Trail actions', onOpen: (anchor) => onOpenActions(trail, anchor) }}
    />
  )
}
