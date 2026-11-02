import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { ActivityWithLinkedTrail } from '../activities/linkedTrail'
import { useTheme } from '../theme/useTheme'
import { EnumBadge } from '../components/EnumBadge'
import { effortField } from '../activities/effort'
import { formatActivityDate, formatActivitySummary, formatDuration } from '../activities/format'
import { formatDistance, formatElevation } from '../format/units'
import { MetricsGrid } from '../components/MetricsGrid'
import { ElevationGraph } from '../elevation/ElevationGraph'
import type { RouteDisplay } from '../elevation/routeDisplay'

export function ActivityInfoSheet({
  activity,
  display,
  onViewLinkedTrail,
}: {
  activity: ActivityWithLinkedTrail
  display: RouteDisplay | null
  onViewLinkedTrail: (trailId: number) => void
}) {
  const c = useTheme()
  const { linkedTrail } = activity

  return (
    <>
      <Text style={[styles.name, { color: c.panelContent }]} numberOfLines={1}>{activity.name}</Text>
      <View style={styles.summaryRow}>
        <EnumBadge field={effortField} value={activity.effort} />
        <Text style={[styles.summary, { color: c.onSurfaceVariant }]}>
          {formatActivitySummary(activity.metrics)}  ·  {formatActivityDate(activity.startedAt)}
        </Text>
      </View>

      {display && <ElevationGraph display={display} placement="inSheet" />}

      <MetricsGrid
        items={[
          { label: 'Distance', value: formatDistance(activity.metrics.distanceMeters) },
          { label: 'Duration', value: formatDuration(activity.metrics.durationSeconds) },
          { label: 'Elev. Gain', value: formatElevation(activity.metrics.elevationGainMeters) },
          { label: 'Elev. Loss', value: formatElevation(activity.metrics.elevationLossMeters) },
        ]}
      />

      {activity.comments != null && (
        <Text style={[styles.comments, { color: c.panelContent }]}>{activity.comments}</Text>
      )}

      {linkedTrail && (
        <Pressable
          accessibilityLabel="View linked trail"
          onPress={() => onViewLinkedTrail(linkedTrail.id)}
          style={[styles.linkBtn, { borderColor: c.trailLine }]}
        >
          <Ionicons name="trail-sign-outline" size={18} color={c.trailLine} />
          <Text style={[styles.linkLabel, { color: c.trailLine }]} numberOfLines={1}>
            View linked trail: {linkedTrail.name}
          </Text>
        </Pressable>
      )}
    </>
  )
}

const styles = StyleSheet.create({
  name: { fontSize: 18, fontWeight: '700' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summary: { fontSize: 13, flexShrink: 1 },
  comments: { fontSize: 14, lineHeight: 20 },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 },
  linkLabel: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
})
