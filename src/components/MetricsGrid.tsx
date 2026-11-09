import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../theme/useTheme'
import { rowsOf } from './rowsOf'

export interface MetricTile {
  label: string
  value: string
  onPress?: () => void
  accessibilityLabel?: string
}

const COLUMNS = 3
const VALUE_SIZE = 15
const VALUE_MIN_SIZE = 11

export function MetricsGrid({ items }: { items: MetricTile[] }) {
  const c = useTheme()
  return (
    <View style={[styles.metrics, { backgroundColor: c.surface }]}>
      {rowsOf(items, COLUMNS).map((row, index) => (
        <View key={index} style={styles.row}>
          {row.map((item) => {
            const body = (
              <>
                <Text
                  style={[styles.metricValue, { color: c.onSurface }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={VALUE_MIN_SIZE / VALUE_SIZE}
                >
                  {item.value}
                </Text>
                <Text style={[styles.metricLabel, { color: c.onSurfaceVariant }]} numberOfLines={2}>
                  {item.label}
                </Text>
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
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  metrics: { borderRadius: 12, padding: 12, gap: 12 },
  row: { flexDirection: 'row' },
  metricItem: { width: `${100 / COLUMNS}%`, alignItems: 'center', paddingHorizontal: 4 },
  metricValue: { fontSize: VALUE_SIZE, fontWeight: '700', fontVariant: ['tabular-nums'] },
  metricLabel: { fontSize: 11, marginTop: 2, textAlign: 'center' },
})
