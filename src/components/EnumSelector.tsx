import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../theme/useTheme'
import { EnumField } from './enumField'

export function EnumSelector<T extends string>({
  field,
  value,
  onChange,
}: {
  field: EnumField<T>
  value: T | null
  onChange: (value: T) => void
}) {
  const c = useTheme()
  return (
    <View style={styles.row}>
      {field.values.map((v) => {
        const selected = v === value
        return (
          <Pressable
            key={v}
            accessibilityLabel={`${field.name} ${field.label(v)}`}
            onPress={() => onChange(v)}
            style={[
              styles.chip,
              { borderColor: field.color(v, c), backgroundColor: selected ? field.color(v, c) : 'transparent' },
            ]}
          >
            <Text style={{ color: selected ? c.surface : field.color(v, c), fontWeight: '600' }}>
              {field.label(v)}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  chip: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1.5 },
})
