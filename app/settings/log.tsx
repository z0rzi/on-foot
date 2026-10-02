import { View } from 'react-native'
import { useTheme } from '../../src/theme/useTheme'
import { LogList } from '../../src/log/LogList'
import { useGoBackOrHome } from '../../src/components/useGoBackOrHome'
import { ScreenHeader } from '../../src/components/ScreenHeader'

export default function DebugLogScreen() {
  const c = useTheme()
  const leave = useGoBackOrHome()
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScreenHeader title="Debug log" onBack={leave} />
      <LogList />
    </View>
  )
}
