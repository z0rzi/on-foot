import { useCallback, useEffect, useRef, useState } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { useIsFocused } from 'expo-router'
import { StyleSheet, View } from 'react-native'
import { runOnJS, useAnimatedReaction, useDerivedValue, useSharedValue } from 'react-native-reanimated'
import { BottomSheetModal } from '@gorhom/bottom-sheet'
import { MapCanvas } from './MapCanvas'
import { MapInfoSheet } from './MapInfoSheet'
import { MapControls } from './MapControls'
import { RecordButton } from './RecordButton'
import { PausedControls } from './PausedControls'
import { LayersSheet } from './LayersSheet'
import { ClusterListSheet } from './overview/ClusterListSheet'
import { MapStatusPill } from './MapStatusPill'
import { pillContent } from './pillContent'
import { cameraPadding, type PillMeasure } from './cameraPadding'
import { sheetRest } from './sheetRest'
import { SHEET_NAV_ROW_HEIGHT } from './SheetNavRow'
import { HideableOverlay } from './HideableOverlay'
import { useLocationPermission } from './useLocationPermission'
import { useSelectedTrail } from './useSelectedTrail'
import { useSelectedActivity } from './useSelectedActivity'
import { TrailInfoSheet } from '../trails/TrailInfoSheet'
import { ActivityInfoSheet } from '../activities/ActivityInfoSheet'
import { RecordingInfoSheet } from '../recording/RecordingInfoSheet'
import { useMapStore, type Selection } from '../store/mapStore'
import { mapMode, trailToShow } from './mapMode'
import { useRecordingStore } from '../recording/recordingStore'
import { recordingPhase } from '../recording/recordingPhase'
import { useLiveSegments } from '../recording/useLiveSegments'
import { recordingHealthFor } from '../recording/streamHealth'
import { useRouteDisplay } from './useRouteDisplay'
import { useGraphPuck } from './useGraphPuck'
import { logEvent } from '../log'
import { useSheetGeometryLog } from './useSheetGeometryLog'
import { useHeadingLog } from './useHeadingLog'
import { overlayBottom, overlaysHidden, sheetHeightAbove } from './overlayGeometry'
import { statusBarStyleOverMap } from './statusBarOverMap'
import { useCurrentMapStyle } from './useCurrentMapStyle'

export function MapScreen() {
  const sheetRef = useRef<BottomSheetModal>(null)
  const clusterListRef = useRef<BottomSheetModal>(null)
  const [listed, setListed] = useState<Selection[]>([])
  const openClusterList = useCallback((items: Selection[]) => {
    setListed(items)
    clusterListRef.current?.present()
  }, [])
  useLocationPermission()
  const focused = useIsFocused()
  const mapStyle = useCurrentMapStyle()
  const insets = useSafeAreaInsets()
  const trail = useSelectedTrail()
  const activity = useSelectedActivity()
  const select = useMapStore((s) => s.select)
  const clearSelection = useMapStore((s) => s.clearSelection)
  const recenter = useMapStore((s) => s.recenter)
  const selection = useMapStore((s) => s.selection)
  const phase = useRecordingStore((s) => recordingPhase(s.session))
  const recording = phase !== 'idle'
  const mode = mapMode({ recording, selection })
  // Root height + the card's live top edge drive the overlays' bottom, so they ride continuously on
  // the card's top edge.
  const rootHeight = useSharedValue(0)
  const sheetTop = useSharedValue(0)
  // The card's live height above the root's bottom, its margin included: the edge the overlays ride on.
  const sheetHeight = useDerivedValue(() => sheetHeightAbove(rootHeight.value, sheetTop.value))
  const controlsBottom = useDerivedValue(() => overlayBottom(sheetHeight.value))
  const [hideOverlays, setHideOverlays] = useState(false)
  useAnimatedReaction(
    () => overlaysHidden(sheetHeight.value, rootHeight.value),
    (hidden, previous) => {
      if (hidden !== previous) runOnJS(setHideOverlays)(hidden)
    },
  )
  const livePoints = useRecordingStore((s) => s.livePoints)

  const liveSegments = useLiveSegments()
  const display = useRouteDisplay(mode, trail, activity, liveSegments)
  const puck = useGraphPuck(mode, display, livePoints)

  const locationAvailable = useRecordingStore((s) => s.locationAvailable)
  const stream = useRecordingStore((s) => s.stream)
  const pill = pillContent({ mode, health: recordingHealthFor({ phase, locationAvailable, stream }), trail, activity })
  const [pillMeasure, setPillMeasure] = useState<PillMeasure | null>(null)
  const rest = sheetRest({
    mode,
    graphShown: display !== null,
    navRowHeight: SHEET_NAV_ROW_HEIGHT,
    systemInset: insets.bottom,
  })
  const camera = cameraPadding({
    topInset: insets.top,
    pill: { kind: pill.kind, measured: pillMeasure },
    sheet: rest,
  })

  // One sheet instance for the life of the screen, its content switched by mode. Three sheets that
  // mounted and unmounted as the mode changed could hand over mid-animation: the outgoing one left
  // its last position in sheetTop and the incoming one never reached its snap point, so a recording
  // resumed on launch showed no sheet at all until the app was restarted (FIELD-2).
  const sheetContent =
    mode === 'trail' && trail ? (
      <TrailInfoSheet trail={trail} onSelectActivity={(id) => select('activity', id)} />
    ) : mode === 'activity' && activity ? (
      <ActivityInfoSheet
        activity={activity}
        onViewLinkedTrail={(id) => select('trail', id)}
        onSelectActivity={(id) => select('activity', id)}
      />
    ) : mode === 'recording' && trail ? (
      <RecordingInfoSheet trail={trail} display={display} puck={puck} onRemoveTrail={clearSelection} />
    ) : null

  useEffect(() => {
    logEvent('info', 'map', 'map mode', { mode })
  }, [mode])

  useSheetGeometryLog({ mode, sheetTop, rootHeight, sheetHeight })
  useHeadingLog()

  return (
    <>
      {/* Mounted only while the Map is focused: it sits on top of the root's status bar style, which
          the pushed screens get back. */}
      {focused ? <StatusBar style={statusBarStyleOverMap(mapStyle.tone)} /> : null}
      <View style={{ flex: 1 }} onLayout={(e) => rootHeight.set(e.nativeEvent.layout.height)}>
        <MapCanvas
          trail={trailToShow(mode, trail)}
          activity={mode === 'activity' ? activity : null}
          display={display}
          camera={camera}
          onOverviewList={openClusterList}
        />
        <HideableOverlay hidden={hideOverlays} style={StyleSheet.absoluteFill}>
          {phase !== 'paused' && (
            <RecordButton animatedBottom={controlsBottom} />
          )}
          {phase === 'paused' && (
            <PausedControls animatedBottom={controlsBottom} />
          )}
          <MapControls
            onOpenLayers={() => sheetRef.current?.present()}
            onFrameRoute={selection ? recenter : undefined}
            animatedBottom={controlsBottom}
          />
        </HideableOverlay>
        {pill.kind !== 'none' && (
          <MapStatusPill
            key={pill.kind}
            content={pill}
            onClear={clearSelection}
            onMeasure={(bottom) => setPillMeasure({ kind: pill.kind, bottom })}
          />
        )}
        <MapInfoSheet
          mode={mode}
          rest={rest}
          display={display}
          puck={puck}
          animatedPosition={sheetTop}
          onIndexChange={(index) => logEvent('info', 'map', 'sheet settled', { mode, index })}
        >
          {sheetContent}
        </MapInfoSheet>
      </View>
      <LayersSheet ref={sheetRef} />
      <ClusterListSheet
        ref={clusterListRef}
        items={listed}
        onSelect={(item) => {
          clusterListRef.current?.dismiss()
          select(item.kind, item.id)
        }}
      />
    </>
  )
}
