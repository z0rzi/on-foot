import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Difficulty } from '../data/trails/types'
import { useTheme } from '../theme/useTheme'
import { DIFFICULTIES, difficultyColor, difficultyLabel } from './difficulty'

export function DifficultySelector({ value, onChange }: { value: Difficulty | null; onChange: (d: Difficulty) => void }) {
  const c = useTheme()
  return (
    <View style={styles.row}>
      {DIFFICULTIES.map((d) => {
        const selected = d === value
        return (
          <Pressable
            key={d}
            accessibilityLabel={`Difficulty ${difficultyLabel(d)}`}
            onPress={() => onChange(d)}
            style={[
              styles.chip,
              { borderColor: difficultyColor(d, c), backgroundColor: selected ? difficultyColor(d, c) : 'transparent' },
            ]}
          >
            <Text style={{ color: selected ? c.surface : difficultyColor(d, c), fontWeight: '600' }}>
              {difficultyLabel(d)}
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
