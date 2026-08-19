import { useState } from 'react'
import { View } from 'react-native'
import { MapProviderProvider } from '../src/map/provider'
import { mapboxProvider } from '../src/map/providers/mapbox'
import { MapCanvas } from '../src/map/MapCanvas'
import { MapControls } from '../src/map/MapControls'

export default function MapTab() {
  // The layers sheet itself is wired in Task 9; this is a stub setter for now.
  const [layersOpen, setLayersOpen] = useState(false)

  return (
    <MapProviderProvider provider={mapboxProvider}>
      <View style={{ flex: 1 }}>
        <MapCanvas />
        <MapControls onOpenLayers={() => setLayersOpen(true)} />
      </View>
    </MapProviderProvider>
  )
}
