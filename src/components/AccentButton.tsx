import { Pressable, StyleSheet, Text } from 'react-native'
import { useTheme } from '../theme/useTheme'

export function AccentButton({
  label,
  onPress,
  accessibilityLabel,
}: {
  label: string
  onPress: () => void
  accessibilityLabel?: string
}) {
  const c = useTheme()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={[styles.button, { backgroundColor: c.controlAccent }]}
    >
      <Text style={[styles.label, { color: c.onControlAccent }]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: { borderRadius: 12, paddingVertical: 6, paddingHorizontal: 14 },
  label: { fontSize: 14, fontWeight: '700' },
})
