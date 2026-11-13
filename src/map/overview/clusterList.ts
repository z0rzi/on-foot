import type { Selection } from '../../store/mapStore'
import type { ActivitySummary } from '../../data/activities/types'
import { familiesByTrail } from '../../data/activities/family'

type TrailRow = { id: number }
type ActivityRow = Pick<ActivitySummary, 'id' | 'linkedTrailId' | 'startedAt'>

type ClusterListRow<T, A> = { kind: 'trail'; trail: T; completed: number } | { kind: 'activity'; activity: A }

// The listed items as rows, in the list's order, a trail with its completed count. An item no row
// has, as one deleted while the list is open, is left out.
export function clusterListRows<T extends TrailRow, A extends ActivityRow>(
  items: readonly Selection[],
  trails: readonly T[],
  activities: readonly A[],
): ClusterListRow<T, A>[] {
  const trailById = new Map(trails.map((t) => [t.id, t]))
  const activityById = new Map(activities.map((a) => [a.id, a]))
  const families = familiesByTrail(activities)
  const rows: ClusterListRow<T, A>[] = []
  for (const item of items) {
    if (item.kind === 'trail') {
      const trail = trailById.get(item.id)
      if (trail) rows.push({ kind: 'trail', trail, completed: families.get(trail.id)?.length ?? 0 })
    } else {
      const activity = activityById.get(item.id)
      if (activity) rows.push({ kind: 'activity', activity })
    }
  }
  return rows
}
