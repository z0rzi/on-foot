import { Ionicons } from '@expo/vector-icons'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MapTokens } from '../theme/tokens'

export function MapModeChip({
  label,
  icon,
  color,
  onExit,
  exitAccessibilityLabel,
}: {
  label: string
  icon: keyof typeof Ionicons.glyphMap
  color: string
  onExit: () => void
  exitAccessibilityLabel: string
}) {
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.wrap, { top: insets.top + MapTokens.controlsSpacing }]} pointerEvents="box-none">
      <View style={[styles.chip, { backgroundColor: color }]}>
        <Ionicons name={icon} size={16} color="#FFFFFF" />
        <Text style={styles.label} numberOfLines={1}>{label}</Text>
        <Pressable accessibilityLabel={exitAccessibilityLabel} onPress={onExit} hitSlop={8}>
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
