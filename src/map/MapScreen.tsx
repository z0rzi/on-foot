import { useRef, useState } from 'react'
import { View } from 'react-native'
import { BottomSheetModal, BottomSheetModalProvider } from '@gorhom/bottom-sheet'
import { MapProviderProvider } from './provider'
import { mapboxProvider } from './providers/mapbox'
import { MapCanvas } from './MapCanvas'
import { MapControls } from './MapControls'
import { RecordButton } from './RecordButton'
import { LayersSheet } from './LayersSheet'
import { ActivityModeChip } from './ActivityModeChip'
import { ActivityInfoSheet } from './ActivityInfoSheet'
import { useLocationPermission } from './useLocationPermission'
import { useSelectedTrail } from './useSelectedTrail'
import { useSelectedActivity } from './useSelectedActivity'
import { TrailInfoCard } from '../trails/TrailInfoCard'
import { useMapStore, mapMode } from '../store/mapStore'
import { useRecordingStore, recordingPhase } from '../recording/recordingStore'
import { MapTokens } from '../theme/tokens'

export function MapScreen() {
  const sheetRef = useRef<BottomSheetModal>(null)
  useLocationPermission()
  const trail = useSelectedTrail()
  const activity = useSelectedActivity()
  const clearSelectedTrail = useMapStore((s) => s.clearSelectedTrail)
  const clearSelectedActivity = useMapStore((s) => s.clearSelectedActivity)
  const selectTrail = useMapStore((s) => s.selectTrail)
  const selectedActivityId = useMapStore((s) => s.selectedActivityId)
  const selectedTrailId = useMapStore((s) => s.selectedTrailId)
  const recording = useRecordingStore((s) => recordingPhase(s.session) !== 'idle')
  const mode = mapMode({ recording, selectedActivityId, selectedTrailId })
  // Measured height of the trail info card, so the controls sit clear above it while it is shown.
  const [cardHeight, setCardHeight] = useState(0)

  const trailLift = mode === 'trail' && trail ? cardHeight + MapTokens.controlsSpacing : 0

  return (
    <MapProviderProvider provider={mapboxProvider}>
      <BottomSheetModalProvider>
        <View style={{ flex: 1 }}>
          <MapCanvas trail={mode === 'trail' ? trail : null} activity={mode === 'activity' ? activity : null} />
          {mode !== 'activity' && <RecordButton extraBottom={trailLift} />}
          <MapControls
            onOpenLayers={() => sheetRef.current?.present()}
            extraBottom={trailLift}
          />
          {mode === 'trail' && trail && (
            <TrailInfoCard trail={trail} onClose={clearSelectedTrail} onHeightChange={setCardHeight} />
          )}
          {mode === 'activity' && activity && (
            <>
              <ActivityModeChip activity={activity} onExit={clearSelectedActivity} />
              <ActivityInfoSheet activity={activity} onViewLinkedTrail={(id) => selectTrail(id)} />
            </>
          )}
        </View>
        <LayersSheet ref={sheetRef} />
      </BottomSheetModalProvider>
    </MapProviderProvider>
  )
}
