import type { OverviewClass, OverviewItem } from '../provider/types'
import type { TrailOverviewRow } from '../../data/trails/types'
import type { ActivityOverviewRow } from '../../data/activities/types'

type TrailRow = Pick<TrailOverviewRow, 'id' | 'overviewGeometry'>
type ActivityRow = Pick<ActivityOverviewRow, 'id' | 'linkedTrailId' | 'overviewGeometry'>

// An item's key on the map: what the focus names it by, and what a press returns.
export function overviewKey(kind: 'trail' | 'activity', id: number): string {
  return `${kind}-${id}`
}

// An activity is linked when its trail is among the trails, so an activity whose trail is gone is
// shown as one tied to no trail.
export function activityClass(activity: Pick<ActivityRow, 'linkedTrailId'>, trailIds: ReadonlySet<number>): OverviewClass {
  return activity.linkedTrailId != null && trailIds.has(activity.linkedTrailId) ? 'linkedActivity' : 'activity'
}

// Every row with an overview geometry, as the map's overview items.
export function overviewItems(trails: readonly TrailRow[], activities: readonly ActivityRow[]): OverviewItem[] {
  const trailIds = new Set(trails.map((t) => t.id))
  const items: OverviewItem[] = []
  for (const t of trails) {
    if (t.overviewGeometry != null) items.push({ key: overviewKey('trail', t.id), class: 'trail', geometry: t.overviewGeometry })
  }
  for (const a of activities) {
    if (a.overviewGeometry == null) continue
    items.push({ key: overviewKey('activity', a.id), class: activityClass(a, trailIds), geometry: a.overviewGeometry })
  }
  return items
}
