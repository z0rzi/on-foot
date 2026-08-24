import { useRef, useState } from 'react'
import { View } from 'react-native'
import { useSharedValue, useDerivedValue } from 'react-native-reanimated'
import { BottomSheetModal, BottomSheetModalProvider } from '@gorhom/bottom-sheet'
import { MapProviderProvider } from './provider'
import { mapboxProvider } from './providers/mapbox'
import { MapCanvas } from './MapCanvas'
import { MapControls } from './MapControls'
import { RecordButton } from './RecordButton'
import { LayersSheet } from './LayersSheet'
import { MapModeChip } from './MapModeChip'
import { ActivityInfoSheet } from './ActivityInfoSheet'
import { useLocationPermission } from './useLocationPermission'
import { useSelectedTrail } from './useSelectedTrail'
import { useSelectedActivity } from './useSelectedActivity'
import { TrailInfoCard } from '../trails/TrailInfoCard'
import { useMapStore, mapMode } from '../store/mapStore'
import { useRecordingStore, recordingPhase } from '../recording/recordingStore'
import { useTheme } from '../theme/useTheme'
import { MapTokens } from '../theme/tokens'

export function MapScreen() {
  const sheetRef = useRef<BottomSheetModal>(null)
  useLocationPermission()
  const c = useTheme()
  const trail = useSelectedTrail()
  const activity = useSelectedActivity()
  const select = useMapStore((s) => s.select)
  const clearSelection = useMapStore((s) => s.clearSelection)
  const selection = useMapStore((s) => s.selection)
  const recording = useRecordingStore((s) => recordingPhase(s.session) !== 'idle')
  const mode = mapMode({ recording, selection })
  // Measured height of the trail info card, so the controls sit clear above it while it is shown.
  const [cardHeight, setCardHeight] = useState(0)
  // Root height + the activity sheet's live top edge drive the controls' bottom in Activity mode, so
  // the cluster rides continuously above the variable-height sheet.
  const rootHeight = useSharedValue(0)
  const sheetTop = useSharedValue(0)
  const controlsAnimatedBottom = useDerivedValue(() =>
    rootHeight.value === 0 || sheetTop.value === 0
      ? 0
      : rootHeight.value - sheetTop.value + MapTokens.controlsSpacing,
  )

  const trailLift = mode === 'trail' && trail ? cardHeight + MapTokens.controlsSpacing : 0

  return (
    <MapProviderProvider provider={mapboxProvider}>
      <BottomSheetModalProvider>
        <View style={{ flex: 1 }} onLayout={(e) => { rootHeight.value = e.nativeEvent.layout.height }}>
          <MapCanvas trail={mode === 'trail' ? trail : null} activity={mode === 'activity' ? activity : null} />
          {mode !== 'activity' && <RecordButton extraBottom={trailLift} />}
          <MapControls
            onOpenLayers={() => sheetRef.current?.present()}
            extraBottom={trailLift}
            animatedBottom={mode === 'activity' ? controlsAnimatedBottom : undefined}
          />
          {mode === 'trail' && trail && (
            <TrailInfoCard trail={trail} onClose={clearSelection} onHeightChange={setCardHeight} />
          )}
          {mode === 'activity' && activity && (
            <>
              <MapModeChip
                icon="walk"
                color={c.activityLine}
                label={`Viewing activity · ${activity.name}`}
                onExit={clearSelection}
              />
              <ActivityInfoSheet
                activity={activity}
                onViewLinkedTrail={(id) => select('trail', id)}
                animatedPosition={sheetTop}
              />
            </>
          )}
        </View>
        <LayersSheet ref={sheetRef} />
      </BottomSheetModalProvider>
    </MapProviderProvider>
  )
}
