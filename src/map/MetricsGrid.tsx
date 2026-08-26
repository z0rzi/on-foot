import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../theme/useTheme'

export function MetricsGrid({
  items,
}: {
  items: { label: string; value: string; onPress?: () => void; accessibilityLabel?: string }[]
}) {
  const c = useTheme()
  return (
    <View style={[styles.metrics, { backgroundColor: c.surface }]}>
      {items.map((item) => {
        const body = (
          <>
            <Text style={[styles.metricValue, { color: c.onSurface }]}>{item.value}</Text>
            <Text style={[styles.metricLabel, { color: c.onSurfaceVariant }]}>{item.label}</Text>
          </>
        )
        return item.onPress ? (
          <Pressable
            key={item.label}
            onPress={item.onPress}
            accessibilityLabel={item.accessibilityLabel}
            style={styles.metricItem}
          >
            {body}
          </Pressable>
        ) : (
          <View key={item.label} style={styles.metricItem}>
            {body}
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  metrics: { flexDirection: 'row', justifyContent: 'space-evenly', borderRadius: 12, padding: 12 },
  metricItem: { alignItems: 'center' },
  metricValue: { fontSize: 15, fontWeight: '700' },
  metricLabel: { fontSize: 11, marginTop: 2 },
})
