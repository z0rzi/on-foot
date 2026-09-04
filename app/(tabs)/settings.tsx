import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useTheme } from '../../src/theme/useTheme'
import { ELEVATION_SMOOTHING_PRESETS, usePreferencesStore, type ElevationGraphPlacement } from '../../src/settings/preferencesStore'

const PLACEMENT_OPTIONS: { value: ElevationGraphPlacement; label: string }[] = [
  { value: 'floating', label: 'Floating' },
  { value: 'inSheet', label: 'In sheet' },
]

export default function Screen() {
  const c = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const elevationSmoothingMeters = usePreferencesStore((s) => s.elevationSmoothingMeters)
  const setElevationSmoothing = usePreferencesStore((s) => s.setElevationSmoothing)
  const graphPlacement = usePreferencesStore((s) => s.elevationGraphPlacement)
  const setGraphPlacement = usePreferencesStore((s) => s.setElevationGraphPlacement)
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
      <Text style={[styles.sectionLabel, { color: c.onSurfaceVariant }]}>Elevation graph</Text>
      <View style={styles.chipRow}>
        {PLACEMENT_OPTIONS.map((opt) => {
          const selected = opt.value === graphPlacement
          return (
            <Pressable
              key={opt.value}
              accessibilityLabel={`Elevation graph ${opt.label}`}
              accessibilityState={{ selected }}
              onPress={() => setGraphPlacement(opt.value)}
              style={[styles.chip, { borderColor: selected ? c.controlAccent : c.panelDivider }]}
            >
              <Text style={[styles.chipLabel, { color: selected ? c.controlAccent : c.onSurface }]}>
                {opt.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
      <Text style={[styles.sectionLabel, { color: c.onSurfaceVariant }]}>Elevation smoothing</Text>
      <View style={styles.chipRow}>
        {ELEVATION_SMOOTHING_PRESETS.map((m) => {
          const selected = m === elevationSmoothingMeters
          return (
            <Pressable
              key={m}
              accessibilityLabel={`Smoothing ${m === 0 ? 'off' : m + ' m'}`}
              accessibilityState={{ selected }}
              onPress={() => setElevationSmoothing(m)}
              style={[styles.chip, { borderColor: selected ? c.controlAccent : c.panelDivider }]}
            >
              <Text style={[styles.chipLabel, { color: selected ? c.controlAccent : c.onSurface }]}>
                {m === 0 ? 'Off' : `${m} m`}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 12, borderWidth: 1, borderRadius: 12 },
  rowLabel: { flex: 1, fontSize: 15 },
  sectionLabel: { fontSize: 13, fontWeight: '600', marginTop: 24, marginBottom: 8 },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderRadius: 20 },
  chipLabel: { fontSize: 14 },
})
