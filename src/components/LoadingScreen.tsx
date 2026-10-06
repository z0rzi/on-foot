import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { useTheme } from '../theme/useTheme'

export function LoadingScreen() {
  const c = useTheme()
  return (
    <View style={[styles.center, { backgroundColor: c.background }]}>
      <ActivityIndicator size="large" color={c.controlAccent} />
    </View>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})
