import { useEffect, useRef } from 'react'
import { View } from 'react-native'
import { useSharedValue, useDerivedValue } from 'react-native-reanimated'
import { BottomSheetModal } from '@gorhom/bottom-sheet'
import { MapCanvas } from './MapCanvas'
import { MapInfoSheet } from './MapInfoSheet'
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
import { ElevationGraph, GRAPH_HEIGHT } from '../elevation/ElevationGraph'
import { usePreferencesStore } from '../settings/preferencesStore'
import { useRouteDisplay } from './useRouteDisplay'
import { logEvent } from '../log'
import { useSheetGeometryLog } from './useSheetGeometryLog'

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
  // A sheet reports 0 before it has laid out and its own container height while parked at its
  // pre-layout position; neither is an edge to ride, so both fall back to the root's own bottom
  // rather than pushing the graph and controls off the screen.
  const graphBottom = useDerivedValue(() =>
    rootHeight.value === 0 || sheetTop.value === 0 || sheetTop.value >= rootHeight.value
      ? 0
      : rootHeight.value - sheetTop.value,
  )
  const baseControlsBottom = useDerivedValue(() =>
    graphBottom.value === 0 ? 0 : graphBottom.value + MapTokens.controlsSpacing,
  )
  const livePoints = useRecordingStore((s) => s.livePoints)
  const graphPlacement = usePreferencesStore((s) => s.elevationGraphPlacement)

  const display = useRouteDisplay(mode, trail, activity, livePoints)

  // The graph either floats over the map (flush on the sheet's top edge) or lives inside the sheet.
  const showFloatingGraph = graphPlacement === 'floating' && display != null
  const sheetDisplay = graphPlacement === 'inSheet' ? display : null
  // Lift the controls above the floating graph so it doesn't cover them; sit them flush on the
  // graph's top edge (stuck to it). Otherwise ride the sheet top.
  const controlsBottom = useDerivedValue(() =>
    showFloatingGraph ? graphBottom.value + GRAPH_HEIGHT : baseControlsBottom.value,
  )

  // One sheet instance for the life of the screen, its content switched by mode. Three sheets that
  // mounted and unmounted as the mode changed could hand over mid-animation: the outgoing one left
  // its last position in sheetTop and the incoming one never reached its snap point, so a recording
  // resumed on launch showed no sheet at all until the app was restarted (FIELD-2).
  const sheetContent =
    mode === 'trail' && trail ? (
      <TrailInfoSheet trail={trail} display={sheetDisplay} />
    ) : mode === 'activity' && activity ? (
      <ActivityInfoSheet
        activity={activity}
        display={sheetDisplay}
        onViewLinkedTrail={(id) => select('trail', id)}
      />
    ) : mode === 'recording' ? (
      <RecordingInfoSheet
        followedTrailName={trail?.name ?? null}
        display={sheetDisplay}
        onRemoveTrail={clearSelection}
      />
    ) : null

  useEffect(() => {
    logEvent('info', 'map', 'map mode', { mode })
  }, [mode])

  useSheetGeometryLog({ mode, sheetTop, rootHeight, graphBottom })

  return (
    <>
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
          <MapModeChip
            icon="trail-sign"
            color={c.trailLine}
            label={`Viewing trail · ${trail.name}`}
            onExit={clearSelection}
            exitAccessibilityLabel="Exit trail view"
          />
        )}
        {mode === 'activity' && activity && (
          <MapModeChip
            icon="walk"
            color={c.activityLine}
            label={`Viewing activity · ${activity.name}`}
            onExit={clearSelection}
            exitAccessibilityLabel="Exit activity view"
          />
        )}
        {mode === 'recording' && phase === 'paused' && (
          <MapModeChip icon="pause" color={c.recordingLine} label="Paused" />
        )}
        {sheetContent && (
          <MapInfoSheet
            animatedPosition={sheetTop}
            onIndexChange={(index) => logEvent('info', 'map', 'sheet settled', { mode, index })}
          >
            {sheetContent}
          </MapInfoSheet>
        )}
        {showFloatingGraph && (
          <ElevationGraph display={display} placement="floating" animatedBottom={graphBottom} />
        )}
      </View>
      <LayersSheet ref={sheetRef} />
    </>
  )
}
