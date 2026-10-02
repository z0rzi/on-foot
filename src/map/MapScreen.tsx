import { useEffect, useMemo, useRef } from 'react'
import { AppState, View } from 'react-native'
import { useSharedValue, useDerivedValue } from 'react-native-reanimated'
import { BottomSheetModal } from '@gorhom/bottom-sheet'
import { MapCanvas } from './MapCanvas'
import { MapControls } from './MapControls'
import { RecordButton } from './RecordButton'
import { PausedControls } from './PausedControls'
import { LayersSheet } from './LayersSheet'
import { MapModeChip } from './MapModeChip'
import { ActivityInfoSheet } from './ActivityInfoSheet'
import { useLocationPermission } from './useLocationPermission'
import { useSelectedTrail } from './useSelectedTrail'
import { useSelectedActivity } from './useSelectedActivity'
import { TrailInfoSheet } from '../trails/TrailInfoSheet'
import { RecordingInfoSheet } from '../recording/RecordingInfoSheet'
import { useMapStore, mapMode, trailToShow } from '../store/mapStore'
import { useRecordingStore, recordingPhase } from '../recording/recordingStore'
import { useTheme } from '../theme/useTheme'
import { MapTokens } from '../theme/tokens'
import { buildElevationProfile } from '../elevation/profile'
import { ElevationGraph, GRAPH_HEIGHT } from '../elevation/ElevationGraph'
import { usePreferencesStore } from '../settings/preferencesStore'
import { profileSegmentsFor } from './profileSource'
import { logEvent } from '../log'

export function MapScreen() {
  const sheetRef = useRef<BottomSheetModal>(null)
  useLocationPermission()
  const c = useTheme()
  const trail = useSelectedTrail()
  const activity = useSelectedActivity()
  const select = useMapStore((s) => s.select)
  const clearSelection = useMapStore((s) => s.clearSelection)
  const recenter = useMapStore((s) => s.recenter)
  const selection = useMapStore((s) => s.selection)
  const phase = useRecordingStore((s) => recordingPhase(s.session))
  const recording = phase !== 'idle'
  const mode = mapMode({ recording, selection })
  // Root height + the selected sheet's live top edge drive the controls' bottom while a trail or
  // activity is selected, so the cluster rides continuously above the variable-height sheet.
  const rootHeight = useSharedValue(0)
  const sheetTop = useSharedValue(0)
  // The sheet's live top edge, as a bottom offset; the fundamental quantity everything below rides on.
  const graphBottom = useDerivedValue(() =>
    rootHeight.value === 0 || sheetTop.value === 0 ? 0 : rootHeight.value - sheetTop.value,
  )
  const baseControlsBottom = useDerivedValue(() =>
    graphBottom.value === 0 ? 0 : graphBottom.value + MapTokens.controlsSpacing,
  )
  const livePoints = useRecordingStore((s) => s.livePoints)
  const graphPlacement = usePreferencesStore((s) => s.elevationGraphPlacement)

  const activeProfile = useMemo(() => {
    const segments = profileSegmentsFor(mode, trail, activity, livePoints)
    return segments ? buildElevationProfile(segments) : null
  }, [mode, trail, activity, livePoints])

  // The graph either floats over the map (flush on the sheet's top edge) or lives inside the sheet.
  const showFloatingGraph = graphPlacement === 'floating' && activeProfile != null
  const sheetProfile = graphPlacement === 'inSheet' ? activeProfile : null
  // Lift the controls above the floating graph so it doesn't cover them; sit them flush on the
  // graph's top edge (stuck to it). Otherwise ride the sheet top.
  const controlsBottom = useDerivedValue(() =>
    showFloatingGraph ? graphBottom.value + GRAPH_HEIGHT : baseControlsBottom.value,
  )

  useEffect(() => {
    logEvent('info', 'map', 'map mode', { mode })
  }, [mode])

  // FIELD-2: the sheet is sometimes left at the window height after the app is reopened, which drives
  // graphBottom negative. sheetTop is a shared value, so it is read here on the JS thread.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return
      logEvent('info', 'map', 'app active', {
        mode,
        sheetTop: Math.round(sheetTop.value),
        rootHeight: Math.round(rootHeight.value),
        graphBottom: Math.round(graphBottom.value),
      })
    })
    return () => subscription.remove()
  }, [mode, sheetTop, rootHeight, graphBottom])

  return (
    <>
      {/* eslint-disable-next-line react-hooks/immutability -- rootHeight is a reanimated shared value,
          mutated here on layout as reanimated intends; it is also read (never written) by the
          app-active logging effect above, which the rule otherwise mistakes for a render-time read. */}
      <View style={{ flex: 1 }} onLayout={(e) => { rootHeight.value = e.nativeEvent.layout.height }}>
        <MapCanvas trail={trailToShow(mode, trail)} activity={mode === 'activity' ? activity : null} />
        {mode !== 'activity' && phase !== 'paused' && (
          <RecordButton animatedBottom={mode === 'trail' || mode === 'recording' ? controlsBottom : undefined} />
        )}
        {phase === 'paused' && (
          <PausedControls animatedBottom={mode === 'recording' ? controlsBottom : undefined} />
        )}
        <MapControls
          onOpenLayers={() => sheetRef.current?.present()}
          onFrameRoute={selection ? recenter : undefined}
          animatedBottom={mode !== 'free' ? controlsBottom : undefined}
        />
        {mode === 'trail' && trail && (
          <>
            <MapModeChip
              icon="trail-sign"
              color={c.trailLine}
              label={`Viewing trail · ${trail.name}`}
              onExit={clearSelection}
              exitAccessibilityLabel="Exit trail view"
            />
            <TrailInfoSheet trail={trail} profile={sheetProfile} animatedPosition={sheetTop} />
          </>
        )}
        {mode === 'activity' && activity && (
          <>
            <MapModeChip
              icon="walk"
              color={c.activityLine}
              label={`Viewing activity · ${activity.name}`}
              onExit={clearSelection}
              exitAccessibilityLabel="Exit activity view"
            />
            <ActivityInfoSheet
              activity={activity}
              profile={sheetProfile}
              onViewLinkedTrail={(id) => select('trail', id)}
              animatedPosition={sheetTop}
            />
          </>
        )}
        {mode === 'recording' && (
          <>
            {phase === 'paused' && (
              <MapModeChip icon="pause" color={c.recordingLine} label="Paused" />
            )}
            <RecordingInfoSheet
              followedTrailName={trail?.name ?? null}
              profile={sheetProfile}
              onRemoveTrail={clearSelection}
              animatedPosition={sheetTop}
            />
          </>
        )}
        {showFloatingGraph && (
          <ElevationGraph profile={activeProfile} placement="floating" animatedBottom={graphBottom} />
        )}
      </View>
      <LayersSheet ref={sheetRef} />
    </>
  )
}
