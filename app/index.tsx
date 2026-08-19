import Mapbox from '@rnmapbox/maps'
import { View } from 'react-native'
import { MAPBOX_ACCESS_TOKEN } from '../src/map/providers/mapbox/token'

Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN)

export default function MapTab() {
  return (
    <View style={{ flex: 1 }}>
      <Mapbox.MapView style={{ flex: 1 }} styleURL="mapbox://styles/mapbox/standard" />
    </View>
  )
}
