import { Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native'
import { useTheme } from '../theme/useTheme'
import { EnumField } from './enumField'

export function EnumChip<T extends string>({
  field,
  value,
  selected,
  onPress,
  style,
}: {
  field: EnumField<T>
  value: T
  selected: boolean
  onPress: () => void
  style?: StyleProp<ViewStyle>
}) {
  const c = useTheme()
  const colour = field.color(value, c)
  return (
    <Pressable
      accessibilityLabel={`${field.name} ${field.label(value)}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, { borderColor: colour, backgroundColor: selected ? colour : 'transparent' }, style]}
    >
      <Text style={{ color: selected ? c.surface : colour, fontWeight: '600' }}>{field.label(value)}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  chip: { alignItems: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1.5 },
})
