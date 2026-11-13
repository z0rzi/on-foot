import type { OverviewPin, OverviewPinKind } from '../provider/types'
import type { TrailOverviewRow } from '../../data/trails/types'
import type { ActivityOverviewRow } from '../../data/activities/types'
import type { StartPoint } from '../../data/geo/overview'
import { familiesByTrail } from '../../data/activities/family'
import { formatDistance } from '../../format/units'
import { lineFocus, type LineFocusInput } from './lineFocus'
import { activityClass, overviewKey } from './overviewItems'

type Metrics = { metrics: Pick<TrailOverviewRow['metrics'], 'distanceMeters'> }

export interface PinListInput extends Omit<LineFocusInput, 'trails' | 'activities'> {
  trails: readonly (Pick<TrailOverviewRow, 'id' | 'start'> & Metrics)[]
  activities: readonly (Pick<ActivityOverviewRow, 'id' | 'linkedTrailId' | 'startedAt' | 'start'> & Metrics)[]
}

interface Candidate {
  key: string
  start: StartPoint | null
  kind: OverviewPinKind
  tag: string
}

// A completed trail's teardrop carries the activity colour only while activities are shown (D116).
function trailKind(completed: number, toggles: PinListInput['toggles']): OverviewPinKind {
  if (completed === 0) return 'trail'
  return toggles.activities ? 'completedTrailWithActivities' : 'completedTrail'
}

// Every shown trail and activity with a start, as its pin (D104, D116).
function candidates(input: PinListInput, shown: ReadonlySet<string>): Candidate[] {
  const families = familiesByTrail(input.activities)
  const trailIds = new Set(input.trails.map((t) => t.id))
  const list: Candidate[] = []
  if (shown.has('trail')) {
    for (const t of input.trails) {
      const completed = families.get(t.id)?.length ?? 0
      const distance = formatDistance(t.metrics.distanceMeters)
      list.push({
        key: overviewKey('trail', t.id),
        start: t.start,
        kind: trailKind(completed, input.toggles),
        tag: completed > 0 ? `✓${completed} · ${distance}` : distance,
      })
    }
  }
  for (const a of input.activities) {
    if (!shown.has(activityClass(a, trailIds))) continue
    list.push({ key: overviewKey('activity', a.id), start: a.start, kind: 'activity', tag: formatDistance(a.metrics.distanceMeters) })
  }
  return list
}

// The tags kept first where they collide: the family's, then trails not completed, completed
// trails, activities (D136).
const FAMILY_RANK = 0
const RANK: Record<OverviewPinKind, number> = { trail: 1, completedTrail: 2, completedTrailWithActivities: 2, activity: 3 }

// The pins the toggles show, by the line focus: the family's at full strength and ranked first, the
// others dimmed with the rest. The item drawn in full has none, its start being its route's endpoint;
// while recording there are none (D108, D114, D116).
export function pinList(input: PinListInput): OverviewPin[] {
  if (input.phase !== 'idle') return []
  const focus = lineFocus(input)
  const family = new Set(focus.familyKeys)
  const pins: OverviewPin[] = []
  for (const { key, start, kind, tag } of candidates(input, new Set(focus.shownClasses))) {
    if (start == null || key === focus.leftOutKey) continue
    const inFamily = family.has(key)
    pins.push({
      key,
      position: [start.lng, start.lat],
      kind,
      tag,
      dimmed: focus.restDimmed && !inFamily,
      rank: inFamily ? FAMILY_RANK : RANK[kind],
    })
  }
  return pins
}
