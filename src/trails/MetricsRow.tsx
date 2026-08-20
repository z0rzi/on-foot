import { StyleSheet, Text, View } from 'react-native'
import { TrailMetrics } from '../data/trails/types'
import { formatDistance, formatElevation } from '../data/trails/gpx/metrics'
import { useTheme } from '../theme/useTheme'

function MetricItem({ label, value, color, muted }: { label: string; value: string; color: string; muted: string }) {
  return (
    <View style={styles.item}>
      <Text style={[styles.value, { color }]}>{value}</Text>
      <Text style={[styles.label, { color: muted }]}>{label}</Text>
    </View>
  )
}

export function MetricsRow({ metrics }: { metrics: TrailMetrics }) {
  const c = useTheme()
  return (
    <View style={[styles.row, { backgroundColor: c.surface }]}>
      <MetricItem label="Distance" value={formatDistance(metrics.distanceMeters)} color={c.onSurface} muted={c.onSurfaceVariant} />
      <MetricItem label="Elevation Gain" value={formatElevation(metrics.elevationGainMeters)} color={c.onSurface} muted={c.onSurfaceVariant} />
      <MetricItem label="Elevation Loss" value={formatElevation(metrics.elevationLossMeters)} color={c.onSurface} muted={c.onSurfaceVariant} />
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-evenly', borderRadius: 12, padding: 16 },
  item: { alignItems: 'center' },
  value: { fontSize: 16, fontWeight: '700' },
  label: { fontSize: 12, marginTop: 2 },
})
