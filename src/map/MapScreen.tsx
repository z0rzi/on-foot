import { useRef } from 'react'
import { View } from 'react-native'
import { useSharedValue, useDerivedValue } from 'react-native-reanimated'
import { BottomSheetModal } from '@gorhom/bottom-sheet'
import { MapCanvas } from './MapCanvas'
import { MapControls } from './MapControls'
import { RecordButton } from './RecordButton'
import { LayersSheet } from './LayersSheet'
import { MapModeChip } from './MapModeChip'
import { ActivityInfoSheet } from './ActivityInfoSheet'
import { useLocationPermission } from './useLocationPermission'
import { useSelectedTrail } from './useSelectedTrail'
import { useSelectedActivity } from './useSelectedActivity'
import { TrailInfoSheet } from '../trails/TrailInfoSheet'
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
  // Root height + the selected sheet's live top edge drive the controls' bottom while a trail or
  // activity is selected, so the cluster rides continuously above the variable-height sheet.
  const rootHeight = useSharedValue(0)
  const sheetTop = useSharedValue(0)
  const controlsAnimatedBottom = useDerivedValue(() =>
    rootHeight.value === 0 || sheetTop.value === 0
      ? 0
      : rootHeight.value - sheetTop.value + MapTokens.controlsSpacing,
  )

  return (
    <>
      <View style={{ flex: 1 }} onLayout={(e) => { rootHeight.value = e.nativeEvent.layout.height }}>
        <MapCanvas trail={mode === 'trail' ? trail : null} activity={mode === 'activity' ? activity : null} />
        {mode !== 'activity' && (
          <RecordButton animatedBottom={mode === 'trail' ? controlsAnimatedBottom : undefined} />
        )}
        <MapControls
          onOpenLayers={() => sheetRef.current?.present()}
          animatedBottom={mode === 'activity' || mode === 'trail' ? controlsAnimatedBottom : undefined}
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
            <TrailInfoSheet trail={trail} animatedPosition={sheetTop} />
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
              onViewLinkedTrail={(id) => select('trail', id)}
              animatedPosition={sheetTop}
            />
          </>
        )}
      </View>
      <LayersSheet ref={sheetRef} />
    </>
  )
}
