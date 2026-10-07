import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Activity } from '../data/activities/types'
import { trailsRepository } from '../data/trails'
import { useTrailsStore } from '../store/trailsStore'
import { useTheme } from '../theme/useTheme'
import { useLoadedEntity } from '../components/useLoadedEntity'
import { EnumBadge } from '../components/EnumBadge'
import { effortField } from '../activities/effort'
import { formatActivityDate, formatActivitySummary, formatDuration } from '../activities/format'
import { formatDistance, formatElevation } from '../data/geo/metrics'
import { MetricsGrid } from '../components/MetricsGrid'
import { ElevationGraph } from '../elevation/ElevationGraph'
import type { RouteDisplay } from '../elevation/routeDisplay'

export function ActivityInfoSheet({
  activity,
  display,
  onViewLinkedTrail,
}: {
  activity: Activity
  display: RouteDisplay | null
  onViewLinkedTrail: (trailId: number) => void
}) {
  const c = useTheme()
  const trailsVersion = useTrailsStore((s) => s.version)
  // A link that is gone is simply not rendered; the hook logs it. Keyed to the trails mutation
  // count as well as the id, so deleting the linked trail withdraws the link from an open sheet
  // instead of leaving a button that selects something no longer there.
  const { entity: linkedTrail } = useLoadedEntity(activity.linkedTrailId, trailsRepository.getTrail, {
    label: 'linked trail',
    version: trailsVersion,
  })

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
