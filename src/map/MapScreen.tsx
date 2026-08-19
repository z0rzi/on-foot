import { useCallback, useRef } from 'react'
import { View } from 'react-native'
import { BottomSheetModal, BottomSheetModalProvider } from '@gorhom/bottom-sheet'
import { MapProviderProvider } from './provider'
import type { CameraHandle } from './provider'
import { mapboxProvider } from './providers/mapbox'
import { MapCanvas } from './MapCanvas'
import { MapControls } from './MapControls'
import { LayersSheet } from './LayersSheet'
import { useLocationPermission } from './useLocationPermission'

export function MapScreen() {
  const sheetRef = useRef<BottomSheetModal>(null)
  // Owned here (not in MapCanvas or MapControls) so the imperative camera handle can be lifted
  // to both: MapCanvas attaches it to the port's <Camera>, MapControls calls it to drive pitch
  // without ever importing the map SDK.
  const cameraRef = useRef<CameraHandle>(null)
  useLocationPermission()

  const setPitch = useCallback((pitch: number, animated: boolean) => {
    cameraRef.current?.setCamera({ pitch, animationDuration: animated ? 300 : 0 })
  }, [])

  return (
    <MapProviderProvider provider={mapboxProvider}>
      <BottomSheetModalProvider>
        <View style={{ flex: 1 }}>
          <MapCanvas cameraRef={cameraRef} />
          <MapControls onOpenLayers={() => sheetRef.current?.present()} setPitch={setPitch} />
        </View>
        <LayersSheet ref={sheetRef} />
      </BottomSheetModalProvider>
    </MapProviderProvider>
  )
}
