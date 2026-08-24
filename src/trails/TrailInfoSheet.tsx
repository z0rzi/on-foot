import { StyleSheet, Text, View } from 'react-native'
import type { SharedValue } from 'react-native-reanimated'
import { Trail } from '../data/trails/types'
import { formatDistance, formatElevation, formatMetricsSummary } from '../data/trails/gpx/metrics'
import { useTheme } from '../theme/useTheme'
import { DifficultyBadge } from './DifficultyBadge'
import { MapInfoSheet } from '../map/MapInfoSheet'
import { MetricsGrid } from '../map/MetricsGrid'

export function TrailInfoSheet({
  trail,
  animatedPosition,
}: {
  trail: Trail
  animatedPosition?: SharedValue<number>
}) {
  const c = useTheme()
  return (
    <MapInfoSheet animatedPosition={animatedPosition}>
      <Text style={[styles.name, { color: c.panelContent }]} numberOfLines={1}>{trail.name}</Text>
      <View style={styles.summaryRow}>
        <DifficultyBadge difficulty={trail.difficulty} />
        <Text style={[styles.summary, { color: c.onSurfaceVariant }]}>
          {formatMetricsSummary(trail.metrics)}
        </Text>
      </View>

      <MetricsGrid
        items={[
          { label: 'Distance', value: formatDistance(trail.metrics.distanceMeters) },
          { label: 'Elev. Gain', value: formatElevation(trail.metrics.elevationGainMeters) },
          { label: 'Elev. Loss', value: formatElevation(trail.metrics.elevationLossMeters) },
        ]}
      />

      {trail.description != null && (
        <Text style={[styles.comments, { color: c.panelContent }]}>{trail.description}</Text>
      )}
    </MapInfoSheet>
  )
}

const styles = StyleSheet.create({
  name: { fontSize: 18, fontWeight: '700' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summary: { fontSize: 13, flexShrink: 1 },
  comments: { fontSize: 14, lineHeight: 20 },
})
