import { StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { NativeStackHeaderProps } from 'expo-router'
import { useTheme } from '../theme/useTheme'
import { useGoBackOrHome } from './useGoBackOrHome'
import { RecordingBanner } from '../recording/RecordingBanner'
import { IconButton } from './IconButton'

const ROW_HEIGHT = 56

// The root stack's header for every pushed screen: it owns the status-bar inset, so screens lay out
// from under it, and it shows the recording banner while a recording runs, unless the screen opts
// out. The title comes from the screen's options, declared once in app/_layout.tsx.
export function AppHeader({ options, route, recordingBanner = true }: NativeStackHeaderProps & { recordingBanner?: boolean }) {
  const c = useTheme()
  const insets = useSafeAreaInsets()
  const goBack = useGoBackOrHome()
  const title = typeof options.title === 'string' ? options.title : route.name

  return (
    <View style={[styles.header, { paddingTop: insets.top, backgroundColor: c.surface, borderBottomColor: c.panelDivider }]}>
      <View style={styles.titleRow}>
        <IconButton icon="arrow-back" size={24} color={c.onSurface} accessibilityLabel="Back" onPress={goBack} />
        <Text style={[styles.title, { color: c.onSurface }]} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
      </View>
      {recordingBanner && <RecordingBanner />}
    </View>
  )
}

const styles = StyleSheet.create({
  header: { borderBottomWidth: StyleSheet.hairlineWidth },
  titleRow: { height: ROW_HEIGHT, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, gap: 8 },
  title: { flex: 1, fontSize: 20, fontWeight: '700' },
})
