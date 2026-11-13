import type { OverviewClass, OverviewLineFocus } from '../provider/types'
import type { OverviewToggles, Selection } from '../../store/mapStore'
import type { RecordingPhase } from '../../recording/recordingPhase'
import type { TrailOverviewRow } from '../../data/trails/types'
import type { ActivityOverviewRow } from '../../data/activities/types'
import { familiesByTrail } from '../../data/activities/family'
import { overviewKey } from './overviewItems'

export interface LineFocusInput {
  trails: readonly Pick<TrailOverviewRow, 'id'>[]
  activities: readonly Pick<ActivityOverviewRow, 'id' | 'linkedTrailId' | 'startedAt'>[]
  toggles: OverviewToggles
  selection: Selection | null
  // The route drawn in full dress by the route overlay, once its geometry has loaded.
  loadedRoute: Selection | null
  phase: RecordingPhase
}

// With trails shown, a linked activity is left out: its trail stands for it (D104).
function shownClasses(toggles: OverviewToggles): OverviewClass[] {
  const classes: OverviewClass[] = []
  if (toggles.trails) classes.push('trail')
  if (toggles.activities) classes.push('activity')
  if (toggles.activities && !toggles.trails) classes.push('linkedActivity')
  return classes
}

// The trail of the selection's family: the selected trail, or the selected activity's while that
// trail is among the trails, as `overviewItems` classes it.
function familyTrailId(input: LineFocusInput, selection: Selection): number | null {
  if (selection.kind === 'trail') return selection.id
  const linked = input.activities.find((a) => a.id === selection.id)?.linkedTrailId
  return linked != null && input.trails.some((t) => t.id === linked) ? linked : null
}

// The selected item's trail and that trail's activities, most recent first; an activity tied to no
// trail is a family of its own (D109).
function familyKeys(input: LineFocusInput): string[] {
  const { selection } = input
  if (selection == null) return []
  const trailId = familyTrailId(input, selection)
  if (trailId == null) return [overviewKey(selection.kind, selection.id)]
  const family = familiesByTrail(input.activities).get(trailId) ?? []
  return [overviewKey('trail', trailId), ...family.map((a) => overviewKey('activity', a.id))]
}

// A selection or a recording dims the rest (D108). The selected item leaves the overview only once
// its route is drawn in full, so its plain line never blinks out first (D132). While recording, the
// followed trail's family is not drawn (D114).
export function lineFocus(input: LineFocusInput): OverviewLineFocus {
  const { selection, loadedRoute } = input
  const recording = input.phase !== 'idle'
  return {
    shownClasses: shownClasses(input.toggles),
    familyKeys: recording ? [] : familyKeys(input),
    leftOutKey: loadedRoute ? overviewKey(loadedRoute.kind, loadedRoute.id) : null,
    restDimmed: recording || selection != null,
  }
}
