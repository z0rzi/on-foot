import { useRef } from 'react'
import { View } from 'react-native'
import { BottomSheetModal, BottomSheetModalProvider } from '@gorhom/bottom-sheet'
import { MapProviderProvider } from './provider'
import { mapboxProvider } from './providers/mapbox'
import { MapCanvas } from './MapCanvas'
import { MapControls } from './MapControls'
import { LayersSheet } from './LayersSheet'
import { useLocationPermission } from './useLocationPermission'

export function MapScreen() {
  const sheetRef = useRef<BottomSheetModal>(null)
  useLocationPermission()

  return (
    <MapProviderProvider provider={mapboxProvider}>
      <BottomSheetModalProvider>
        <View style={{ flex: 1 }}>
          <MapCanvas />
          <MapControls onOpenLayers={() => sheetRef.current?.present()} />
        </View>
        <LayersSheet ref={sheetRef} />
      </BottomSheetModalProvider>
    </MapProviderProvider>
  )
}
