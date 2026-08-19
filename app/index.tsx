import { View } from 'react-native'
import { MapProviderProvider } from '../src/map/provider'
import { mapboxProvider } from '../src/map/providers/mapbox'
import { MapCanvas } from '../src/map/MapCanvas'

export default function MapTab() {
  return (
    <MapProviderProvider provider={mapboxProvider}>
      <View style={{ flex: 1 }}>
        <MapCanvas />
      </View>
    </MapProviderProvider>
  )
}
