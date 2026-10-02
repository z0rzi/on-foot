import { View } from 'react-native'
import { useTheme } from '../../src/theme/useTheme'
import { OfflineMapsList } from '../../src/map/offline/OfflineMapsList'
import { useGoBackOrHome } from '../../src/components/useGoBackOrHome'
import { ScreenHeader } from '../../src/components/ScreenHeader'

export default function OfflineMapsScreen() {
  const c = useTheme()
  const leave = useGoBackOrHome()
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScreenHeader title="Offline maps" onBack={leave} />
      <OfflineMapsList />
    </View>
  )
}
