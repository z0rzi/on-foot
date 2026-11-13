import React, { useMemo } from 'react'
import type { BottomSheetModal } from '@gorhom/bottom-sheet'
import type { Selection } from '../../store/mapStore'
import { useTrailsStore } from '../../store/trailsStore'
import { useActivitiesStore } from '../../store/activitiesStore'
import { ModalSheet } from '../../components/ModalSheet'
import { TrailListItem } from '../../trails/TrailListItem'
import { ActivityListItem } from '../../activities/ActivityListItem'
import { clusterListRows } from './clusterList'
import { overviewKey } from './overviewItems'

// The items under a press the camera does not tell apart: a row selects its item; closing the list
// selects nothing (D118).
export function ClusterListSheet({
  ref,
  items,
  onSelect,
}: {
  ref: React.RefObject<BottomSheetModal | null>
  items: readonly Selection[]
  onSelect: (selection: Selection) => void
}) {
  const trails = useTrailsStore((s) => s.trails)
  const activities = useActivitiesStore((s) => s.activities)
  const rows = useMemo(() => clusterListRows(items, trails, activities), [items, trails, activities])

  return (
    <ModalSheet ref={ref} title="Trails and activities here">
      {rows.map((row) =>
        row.kind === 'trail' ? (
          <TrailListItem
            key={overviewKey('trail', row.trail.id)}
            variant="compact"
            trail={row.trail}
            completed={row.completed}
            onSelect={(id) => onSelect({ kind: 'trail', id })}
          />
        ) : (
          <ActivityListItem
            key={overviewKey('activity', row.activity.id)}
            variant="compact"
            activity={row.activity}
            onSelect={(id) => onSelect({ kind: 'activity', id })}
          />
        ),
      )}
    </ModalSheet>
  )
}
