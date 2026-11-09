import { View } from 'react-native'
import { useTheme } from '../../src/theme/useTheme'
import { OfflineMapsList } from '../../src/map/offline/OfflineMapsList'

export default function OfflineMapsScreen() {
  const c = useTheme()
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <OfflineMapsList />
    </View>
  )
}
