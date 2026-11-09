import { StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../theme/useTheme'
import { EnumBadge } from './EnumBadge'
import { EnumField } from './enumField'

// An entity's summary lines in the secondary text, its badge leading the first on the same line, as
// its list row and its card show them.
export function EntitySummary<T extends string>({
  badge,
  lines: [first, ...rest],
}: {
  badge: { field: EnumField<T>; value: T }
  lines: [string, ...string[]]
}) {
  const c = useTheme()
  return (
    <View style={styles.summary}>
      <Text style={[styles.line, { color: c.onSurfaceVariant }]}>
        <EnumBadge field={badge.field} value={badge.value} />
        {' · '}
        {first}
      </Text>
      {rest.map((line, index) => (
        <Text key={index} style={[styles.line, { color: c.onSurfaceVariant }]}>
          {line}
        </Text>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  summary: { gap: 4 },
  line: { fontSize: 13 },
})
