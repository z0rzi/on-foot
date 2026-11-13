import { useEffect, useMemo } from 'react'
import { useMapProvider } from '../provider'
import { useTheme } from '../../theme/useTheme'
import { MapTokens } from '../../theme/tokens'
import { useTrailsStore } from '../../store/trailsStore'
import { useActivitiesStore } from '../../store/activitiesStore'
import { useMapStore, type Selection } from '../../store/mapStore'
import { useRecordingStore } from '../../recording/recordingStore'
import { recordingPhase } from '../../recording/recordingPhase'
import { overviewItems } from './overviewItems'
import { lineFocus } from './lineFocus'
import { pinList } from './pinList'
import { useCurrentMapStyle } from '../useCurrentMapStyle'
import { useOverviewPressHandler } from './useOverviewPressHandler'
import { derivedOrEmpty, type Derived } from './derivedOrEmpty'
import type { OverviewItem, OverviewLineFocus, OverviewPin } from '../provider/types'
import { errorClass, logEvent } from '../../log'

const LINE_ZOOM = { from: MapTokens.overviewLineZoomFrom, to: MapTokens.overviewLineZoomTo }
const CLUSTER = { cap: MapTokens.overviewClusterCap, radius: MapTokens.overviewClusterRadius }

const NO_ITEMS: OverviewItem[] = []
const EMPTY_VIEW: { focus: OverviewLineFocus; pins: OverviewPin[] } = {
  focus: { shownClasses: [], familyKeys: [], leftOutKey: null, restDimmed: false },
  pins: [],
}

// Logged once per derivation that throws, not at every render.
function useFailureLogged(derived: Derived<unknown>, part: 'items' | 'focus and pins'): void {
  const { failure } = derived
  useEffect(() => {
    if (failure != null) logEvent('error', 'map', 'overview derivation failed', { part, errorClass: errorClass(failure.error) })
  }, [failure, part])
}

// Every saved trail and activity on the map, as thin plain lines (D103, D106), the selection's
// family brought forward and the rest dimmed while something is selected or recorded (D108). The
// items follow the stores' rows, not their version: a list's focus reload replaces the rows without
// a bump. A selection, a recording or a toggle changes only the focus and the pins, never the items.
// A press on it selects what it hit, clears the selection on nothing, fits a cluster, hands several
// items to `onList`, or names an item while recording. A derivation that throws leaves the overview
// empty; the map stays.
export function OverviewLayer({
  loadedRoute,
  onList,
}: {
  loadedRoute: Selection | null
  onList: (items: Selection[]) => void
}) {
  const { components } = useMapProvider()
  const c = useTheme()
  const trails = useTrailsStore((s) => s.trails)
  const activities = useActivitiesStore((s) => s.activities)
  const selection = useMapStore((s) => s.selection)
  const toggles = useMapStore((s) => s.overviewToggles)
  const phase = useRecordingStore((s) => recordingPhase(s.session))
  const items = useMemo(() => derivedOrEmpty(() => overviewItems(trails, activities), NO_ITEMS), [trails, activities])
  const view = useMemo(() => {
    const input = { trails, activities, toggles, selection, loadedRoute, phase }
    return derivedOrEmpty(() => ({ focus: lineFocus(input), pins: pinList(input) }), EMPTY_VIEW)
  }, [trails, activities, toggles, selection, loadedRoute, phase])
  useFailureLogged(items, 'items')
  useFailureLogged(view, 'focus and pins')
  const { labelFont } = useCurrentMapStyle()
  const onPress = useOverviewPressHandler(onList)
  const { Overview } = components
  return (
    <Overview
      items={items.value}
      focus={view.value.focus}
      trailColor={c.trailLine}
      activityColor={c.activityLine}
      lineWidth={MapTokens.overviewLineWidth}
      lineZoom={LINE_ZOOM}
      dimmedOpacity={MapTokens.overviewDimmedOpacity}
      pins={view.value.pins}
      pinInkColor={c.pinInk}
      clusterColor={c.pinCluster}
      tagTextColor={c.pinTagText}
      pinFont={labelFont}
      cluster={CLUSTER}
      pressTolerance={MapTokens.overviewPressTolerance}
      onPress={onPress}
    />
  )
}
