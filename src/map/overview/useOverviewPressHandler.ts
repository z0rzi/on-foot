import { useCallback, useState } from 'react'
import type { OverviewPress } from '../provider/types'
import { useMapStore, type Selection } from '../../store/mapStore'
import { useTrailsStore } from '../../store/trailsStore'
import { useActivitiesStore } from '../../store/activitiesStore'
import { currentRecordingPhase } from '../../recording/recordingStore'
import { showToast } from '../../components/toast'
import { MapTokens } from '../../theme/tokens'
import { logEvent } from '../../log'
import { resolvePress } from './pressResolution'
import { toastThrottle } from './pressToast'

// What a press on the overview does, read from the stores as they are at the press: idle, it selects
// or, on nothing, clears the selection without moving the camera, fits a cluster or hands several
// items to the list; while recording, it names the item in a toast and selects nothing (D113, D114,
// D118, D139).
export function useOverviewPressHandler(onList: (items: Selection[]) => void): (press: OverviewPress) => void {
  const selectOnMap = useMapStore((s) => s.selectOnMap)
  const clearSelection = useMapStore((s) => s.clearSelection)
  const fitCluster = useMapStore((s) => s.fitCluster)
  const [toastDue] = useState(() => toastThrottle(MapTokens.overviewPressToastMs))
  return useCallback(
    (press) => {
      const outcome = resolvePress(press, {
        trails: useTrailsStore.getState().trails,
        activities: useActivitiesStore.getState().activities,
        selection: useMapStore.getState().selection,
        phase: currentRecordingPhase(),
        clusterCap: MapTokens.overviewClusterCap,
        pressTolerance: MapTokens.overviewPressTolerance,
      })
      logEvent('info', 'map', 'overview press', {
        pins: press.pins.length,
        lines: press.lines.length,
        clusters: press.clusters.length,
        outcome: outcome.kind,
      })
      if (outcome.kind === 'select') selectOnMap(outcome.selection.kind, outcome.selection.id)
      else if (outcome.kind === 'deselect') clearSelection()
      else if (outcome.kind === 'fit') fitCluster(outcome.bounds, outcome.maxZoom)
      else if (outcome.kind === 'list') onList(outcome.items)
      else if (outcome.kind === 'name' && toastDue(outcome.key, Date.now())) showToast(outcome.text)
    },
    [selectOnMap, clearSelection, fitCluster, onList, toastDue],
  )
}
