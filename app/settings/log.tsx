import { View } from 'react-native'
import { useTheme } from '../../src/theme/useTheme'
import { LogList } from '../../src/settings/LogList'

export default function DebugLogScreen() {
  const c = useTheme()
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <LogList />
    </View>
  )
}
