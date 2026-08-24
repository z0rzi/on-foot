import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useTheme } from '../../src/theme/useTheme'

export default function Screen() {
  const c = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.screen, { backgroundColor: c.background, paddingTop: insets.top }]}>
      <Text style={[styles.title, { color: c.onSurface }]}>Settings</Text>
      <Pressable
        accessibilityLabel="Offline maps"
        onPress={() => router.push('/settings/offline')}
        style={[styles.row, { borderColor: c.panelDivider }]}
      >
        <Ionicons name="cloud-download-outline" size={20} color={c.onSurface} />
        <Text style={[styles.rowLabel, { color: c.onSurface }]}>Offline maps</Text>
        <Ionicons name="chevron-forward" size={20} color={c.onSurfaceVariant} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 12, borderWidth: 1, borderRadius: 12 },
  rowLabel: { flex: 1, fontSize: 15 },
})
