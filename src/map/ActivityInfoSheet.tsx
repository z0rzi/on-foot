import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { SharedValue } from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { Activity } from '../data/activities/types'
import { Trail, trailsRepository } from '../data/trails'
import { useTheme } from '../theme/useTheme'
import { EffortBadge } from '../activities/EffortBadge'
import { formatActivityDate, formatActivitySummary, formatDuration } from '../activities/format'
import { formatDistance, formatElevation } from '../data/geo/metrics'
import { MapInfoSheet } from './MapInfoSheet'
import { MetricsGrid } from './MetricsGrid'
import { ElevationGraph } from '../elevation/ElevationGraph'
import type { ElevationProfile } from '../elevation/profile'

export function ActivityInfoSheet({
  activity,
  profile,
  onViewLinkedTrail,
  animatedPosition,
}: {
  activity: Activity
  profile: ElevationProfile | null
  onViewLinkedTrail: (trailId: number) => void
  animatedPosition?: SharedValue<number>
}) {
  const c = useTheme()
  const [linkedTrail, setLinkedTrail] = useState<Trail | null>(null)

  useEffect(() => {
    const id = activity.linkedTrailId
    if (id == null) {
      setLinkedTrail(null)
      return
    }
    let active = true
    void trailsRepository.getTrail(id).then((t) => {
      if (active) setLinkedTrail(t)
    })
    return () => {
      active = false
    }
  }, [activity.linkedTrailId])

  return (
    <MapInfoSheet animatedPosition={animatedPosition}>
      <Text style={[styles.name, { color: c.panelContent }]} numberOfLines={1}>{activity.name}</Text>
      <View style={styles.summaryRow}>
        <EffortBadge effort={activity.effort} />
        <Text style={[styles.summary, { color: c.onSurfaceVariant }]}>
          {formatActivitySummary(activity.metrics)}  ·  {formatActivityDate(activity.startedAt)}
        </Text>
      </View>

      {profile && <ElevationGraph profile={profile} placement="inSheet" />}

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
    </MapInfoSheet>
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
