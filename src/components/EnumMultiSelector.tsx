import { StyleSheet, View } from 'react-native'
import { EnumChip } from './EnumChip'
import { EnumField } from './enumField'

export function EnumMultiSelector<T extends string>({
  field,
  selected,
  onToggle,
}: {
  field: EnumField<T>
  selected: ReadonlySet<T>
  onToggle: (value: T) => void
}) {
  return (
    <View style={styles.row}>
      {field.values.map((v) => (
        <EnumChip key={v} field={field} value={v} selected={selected.has(v)} onPress={() => onToggle(v)} style={styles.chip} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12 },
})
