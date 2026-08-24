import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useTheme } from '../../src/theme/useTheme'
import { OfflineMapsList } from '../../src/map/offline/OfflineMapsList'

export default function OfflineMapsScreen() {
  const c = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.screen, { backgroundColor: c.background, paddingTop: insets.top }]}>
      <View style={styles.nav}>
        <Pressable accessibilityLabel="Back" onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={c.onSurface} />
        </Pressable>
        <Text style={[styles.title, { color: c.onSurface }]}>Offline maps</Text>
      </View>
      <OfflineMapsList />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 12 },
  title: { fontSize: 18, fontWeight: '700' },
})
