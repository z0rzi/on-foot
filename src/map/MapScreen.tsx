import { useRef } from 'react'
import { View } from 'react-native'
import { BottomSheetModal, BottomSheetModalProvider } from '@gorhom/bottom-sheet'
import { MapProviderProvider } from './provider'
import { mapboxProvider } from './providers/mapbox'
import { MapCanvas } from './MapCanvas'
import { MapControls } from './MapControls'
import { LayersSheet } from './LayersSheet'
import { useLocationPermission } from './useLocationPermission'
import { useSelectedTrail } from './useSelectedTrail'
import { TrailInfoCard } from '../trails/TrailInfoCard'
import { useMapStore } from '../store/mapStore'

export function MapScreen() {
  const sheetRef = useRef<BottomSheetModal>(null)
  useLocationPermission()
  const trail = useSelectedTrail()
  const clearSelectedTrail = useMapStore((s) => s.clearSelectedTrail)

  return (
    <MapProviderProvider provider={mapboxProvider}>
      <BottomSheetModalProvider>
        <View style={{ flex: 1 }}>
          <MapCanvas trail={trail} />
          <MapControls onOpenLayers={() => sheetRef.current?.present()} />
          {trail && <TrailInfoCard trail={trail} onClose={clearSelectedTrail} />}
        </View>
        <LayersSheet ref={sheetRef} />
      </BottomSheetModalProvider>
    </MapProviderProvider>
  )
}
