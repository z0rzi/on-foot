import { forwardRef } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

// A bare icon on a 44 dp target, for an icon-only action inside a row of text (a ⋮, a ✕). Map
// controls, which wear a round surface, are ControlButton.
export const IconButton = forwardRef<View, {
  icon: keyof typeof Ionicons.glyphMap
  color: string
  accessibilityLabel: string
  onPress: () => void
  size?: number
}>(function IconButton({ icon, color, accessibilityLabel, onPress, size = 20 }, ref) {
  return (
    <Pressable ref={ref} accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={styles.button}>
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  )
})

const styles = StyleSheet.create({
  button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
})
