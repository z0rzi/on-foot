import { Ionicons } from '@expo/vector-icons'
import { Pressable, StyleSheet, Text } from 'react-native'
import { useTheme } from '../theme/useTheme'

export function SettingsRow({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  onPress: () => void
}) {
  const c = useTheme()
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.row, { borderColor: c.panelDivider }]}
    >
      <Ionicons name={icon} size={20} color={c.onSurface} />
      <Text style={[styles.rowLabel, { color: c.onSurface }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={20} color={c.onSurfaceVariant} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 12, borderWidth: 1, borderRadius: 12 },
  rowLabel: { flex: 1, fontSize: 15 },
})
