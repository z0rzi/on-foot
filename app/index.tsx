import { useRef } from 'react'
import { View } from 'react-native'
import { BottomSheetModal, BottomSheetModalProvider } from '@gorhom/bottom-sheet'
import { MapProviderProvider } from '../src/map/provider'
import { mapboxProvider } from '../src/map/providers/mapbox'
import { MapCanvas } from '../src/map/MapCanvas'
import { MapControls } from '../src/map/MapControls'
import { LayersSheet } from '../src/map/LayersSheet'

export default function MapTab() {
  const sheetRef = useRef<BottomSheetModal>(null)

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
