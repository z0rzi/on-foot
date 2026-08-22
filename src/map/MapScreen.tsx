import { useRef, useState } from 'react'
import { View } from 'react-native'
import { BottomSheetModal, BottomSheetModalProvider } from '@gorhom/bottom-sheet'
import { MapProviderProvider } from './provider'
import { mapboxProvider } from './providers/mapbox'
import { MapCanvas } from './MapCanvas'
import { MapControls } from './MapControls'
import { RecordButton } from './RecordButton'
import { LayersSheet } from './LayersSheet'
import { useLocationPermission } from './useLocationPermission'
import { useSelectedTrail } from './useSelectedTrail'
import { TrailInfoCard } from '../trails/TrailInfoCard'
import { useMapStore } from '../store/mapStore'
import { MapTokens } from '../theme/tokens'

export function MapScreen() {
  const sheetRef = useRef<BottomSheetModal>(null)
  useLocationPermission()
  const trail = useSelectedTrail()
  const clearSelectedTrail = useMapStore((s) => s.clearSelectedTrail)
  // Measured height of the info card, so the controls can sit clear above it while it is shown.
  const [cardHeight, setCardHeight] = useState(0)

  return (
    <MapProviderProvider provider={mapboxProvider}>
      <BottomSheetModalProvider>
        <View style={{ flex: 1 }}>
          <MapCanvas trail={trail} />
          <RecordButton />
          <MapControls
            onOpenLayers={() => sheetRef.current?.present()}
            extraBottom={trail ? cardHeight + MapTokens.controlsSpacing : 0}
          />
          {trail && (
            <TrailInfoCard trail={trail} onClose={clearSelectedTrail} onHeightChange={setCardHeight} />
          )}
        </View>
        <LayersSheet ref={sheetRef} />
      </BottomSheetModalProvider>
    </MapProviderProvider>
  )
}
