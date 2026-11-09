import { StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useTheme } from '../../src/theme/useTheme'
import { ELEVATION_SMOOTHING_PRESETS, usePreferencesStore } from '../../src/settings/preferencesStore'
import { SettingsRow } from '../../src/components/SettingsRow'
import { SettingsChoice, type SettingsOption } from '../../src/components/SettingsChoice'

const SMOOTHING_OPTIONS: SettingsOption<number>[] = ELEVATION_SMOOTHING_PRESETS.map((m) => ({
  value: m,
  label: m === 0 ? 'Off' : `${m} m`,
  accessibilityLabel: `Smoothing ${m === 0 ? 'off' : m + ' m'}`,
}))

export default function Screen() {
  const c = useTheme()
  const router = useRouter()
  const elevationSmoothingMeters = usePreferencesStore((s) => s.elevationSmoothingMeters)
  const setElevationSmoothing = usePreferencesStore((s) => s.setElevationSmoothing)
  return (
    <View style={[styles.screen, { backgroundColor: c.background }]}>
      <View style={styles.rows}>
        <SettingsRow
          icon="cloud-download-outline"
          label="Offline maps"
          onPress={() => router.push('/settings/offline')}
        />
        <SettingsRow
          icon="document-text-outline"
          label="Debug log"
          onPress={() => router.push('/settings/log')}
        />
      </View>
      <SettingsChoice
        title="Elevation smoothing"
        options={SMOOTHING_OPTIONS}
        value={elevationSmoothingMeters}
        onChange={setElevationSmoothing}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16 },
  rows: { gap: 8 },
})
