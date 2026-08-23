import { useEffect, useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet'
import type { SharedValue } from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { Activity } from '../data/activities/types'
import { useTheme } from '../theme/useTheme'
import { useTrailsStore } from '../store/trailsStore'
import { EffortBadge } from '../activities/EffortBadge'
import { formatActivityDate, formatActivitySummary, formatDuration } from '../activities/format'
import { formatDistance, formatElevation } from '../data/trails/gpx/metrics'

export function ActivityInfoSheet({
  activity,
  onViewLinkedTrail,
  animatedPosition,
}: {
  activity: Activity
  onViewLinkedTrail: (trailId: number) => void
  animatedPosition?: SharedValue<number>
}) {
  const c = useTheme()
  const snapPoints = useMemo(() => ['16%', '55%'], [])
  const trails = useTrailsStore((s) => s.trails)
  const loadTrails = useTrailsStore((s) => s.loadTrails)

  useEffect(() => { loadTrails() }, [loadTrails])

  const linkedTrail =
    activity.linkedTrailId != null ? trails.find((t) => t.id === activity.linkedTrailId) : undefined

  return (
    <BottomSheet
      index={0}
      snapPoints={snapPoints}
      enablePanDownToClose={false}
      animatedPosition={animatedPosition}
      backgroundStyle={{ backgroundColor: c.panelBackground }}
      handleIndicatorStyle={{ backgroundColor: c.onSurfaceVariant }}
    >
      <BottomSheetView style={styles.content}>
        <Text style={[styles.name, { color: c.panelContent }]} numberOfLines={1}>{activity.name}</Text>
        <View style={styles.summaryRow}>
          <EffortBadge effort={activity.effort} />
          <Text style={[styles.summary, { color: c.onSurfaceVariant }]}>
            {formatActivitySummary(activity.metrics)}  ·  {formatActivityDate(activity.startedAt)}
          </Text>
        </View>

        <View style={[styles.metrics, { backgroundColor: c.surface }]}>
          <Metric label="Distance" value={formatDistance(activity.metrics.distanceMeters)} color={c.onSurface} muted={c.onSurfaceVariant} />
          <Metric label="Duration" value={formatDuration(activity.metrics.durationSeconds)} color={c.onSurface} muted={c.onSurfaceVariant} />
          <Metric label="Elev. Gain" value={formatElevation(activity.metrics.elevationGainMeters)} color={c.onSurface} muted={c.onSurfaceVariant} />
          <Metric label="Elev. Loss" value={formatElevation(activity.metrics.elevationLossMeters)} color={c.onSurface} muted={c.onSurfaceVariant} />
        </View>

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
      </BottomSheetView>
    </BottomSheet>
  )
}

function Metric({ label, value, color, muted }: { label: string; value: string; color: string; muted: string }) {
  return (
    <View style={styles.metricItem}>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: muted }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  name: { fontSize: 18, fontWeight: '700' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summary: { fontSize: 13, flexShrink: 1 },
  metrics: { flexDirection: 'row', justifyContent: 'space-evenly', borderRadius: 12, padding: 12 },
  metricItem: { alignItems: 'center' },
  metricValue: { fontSize: 15, fontWeight: '700' },
  metricLabel: { fontSize: 11, marginTop: 2 },
  comments: { fontSize: 14, lineHeight: 20 },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 },
  linkLabel: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
})
