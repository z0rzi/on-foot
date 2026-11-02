import { StyleSheet, View } from 'react-native'
import { EnumChip } from './EnumChip'
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
  return (
    <View style={styles.row}>
      {field.values.map((v) => (
        <EnumChip key={v} field={field} value={v} selected={v === value} onPress={() => onChange(v)} style={styles.chip} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  chip: { flex: 1 },
})
