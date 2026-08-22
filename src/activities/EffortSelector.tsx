import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Effort } from '../data/activities/types'
import { useTheme } from '../theme/useTheme'
import { EFFORTS, effortColor, effortLabel } from './effort'

export function EffortSelector({ value, onChange }: { value: Effort | null; onChange: (e: Effort) => void }) {
  const c = useTheme()
  return (
    <View style={styles.row}>
      {EFFORTS.map((e) => {
        const selected = e === value
        return (
          <Pressable
            key={e}
            accessibilityLabel={`Effort ${effortLabel(e)}`}
            onPress={() => onChange(e)}
            style={[
              styles.chip,
              { borderColor: effortColor(e, c), backgroundColor: selected ? effortColor(e, c) : 'transparent' },
            ]}
          >
            <Text style={{ color: selected ? c.surface : effortColor(e, c), fontWeight: '600' }}>
              {effortLabel(e)}
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
