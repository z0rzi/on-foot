import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../theme/useTheme'

export interface SettingsOption<T> {
  value: T
  label: string
  accessibilityLabel: string
}

// A Settings section that picks one of a few values: its title over a row of outlined chips, the
// chosen one in the accent colour.
export function SettingsChoice<T extends string | number>({
  title,
  options,
  value,
  onChange,
}: {
  title: string
  options: readonly SettingsOption<T>[]
  value: T
  onChange: (value: T) => void
}) {
  const c = useTheme()
  return (
    <>
      <Text style={[styles.title, { color: c.onSurfaceVariant }]}>{title}</Text>
      <View style={styles.chipRow}>
        {options.map((opt) => {
          const selected = opt.value === value
          return (
            <Pressable
              key={opt.value}
              accessibilityLabel={opt.accessibilityLabel}
              accessibilityState={{ selected }}
              onPress={() => onChange(opt.value)}
              style={[styles.chip, { borderColor: selected ? c.controlAccent : c.panelDivider }]}
            >
              <Text style={[styles.chipLabel, { color: selected ? c.controlAccent : c.onSurface }]}>{opt.label}</Text>
            </Pressable>
          )
        })}
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  title: { fontSize: 13, fontWeight: '600', marginTop: 24, marginBottom: 8 },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderRadius: 20 },
  chipLabel: { fontSize: 14 },
})
