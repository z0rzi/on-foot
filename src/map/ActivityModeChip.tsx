import { Ionicons } from '@expo/vector-icons'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Activity } from '../data/activities/types'
import { useTheme } from '../theme/useTheme'
import { MapTokens } from '../theme/tokens'

export function ActivityModeChip({ activity, onExit }: { activity: Activity; onExit: () => void }) {
  const c = useTheme()
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.wrap, { top: insets.top + MapTokens.controlsSpacing }]} pointerEvents="box-none">
      <View style={[styles.chip, { backgroundColor: c.activityLine }]}>
        <Ionicons name="walk" size={16} color="#FFFFFF" />
        <Text style={styles.label} numberOfLines={1}>Viewing activity · {activity.name}</Text>
        <Pressable accessibilityLabel="Exit activity view" onPress={onExit} hitSlop={8}>
          <Ionicons name="close" size={18} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: 16 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '100%',
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, elevation: 6,
  },
  label: { color: '#FFFFFF', fontWeight: '700', fontSize: 14, flexShrink: 1 },
})
