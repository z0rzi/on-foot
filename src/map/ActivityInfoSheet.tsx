import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { ActivityWithLinkedTrail } from '../activities/linkedTrail'
import { useTheme } from '../theme/useTheme'
import { EnumBadge } from '../components/EnumBadge'
import { effortField } from '../activities/effort'
import { formatActivityDate, formatAveragePace } from '../activities/format'
import { formatDistance, formatDuration, formatElevation } from '../format/units'
import { MetricsGrid } from '../components/MetricsGrid'
import type { MenuAnchor } from '../components/ActionsMenu'
import { ActionsMenuButton } from '../components/ActionsMenuButton'
import { ActivityActions } from '../activities/ActivityActions'

export function ActivityInfoSheet({
  activity,
  onViewLinkedTrail,
}: {
  activity: ActivityWithLinkedTrail
  onViewLinkedTrail: (trailId: number) => void
}) {
  const c = useTheme()
  const { linkedTrail } = activity
  const [menuAnchor, setMenuAnchor] = useState<MenuAnchor | null>(null)

  return (
    <>
      <View style={styles.titleRow}>
        <Text style={[styles.name, { color: c.panelContent }]}>{activity.name}</Text>
        <ActionsMenuButton accessibilityLabel="Activity actions" onOpen={setMenuAnchor} />
      </View>
      <View style={styles.summaryRow}>
        <EnumBadge field={effortField} value={activity.effort} />
        <Text style={[styles.summary, { color: c.onSurfaceVariant }]}>{formatActivityDate(activity.startedAt)}</Text>
      </View>

      <MetricsGrid
        items={[
          { label: 'Distance', value: formatDistance(activity.metrics.distanceMeters) },
          { label: 'Duration', value: formatDuration(activity.metrics.durationSeconds) },
          { label: 'Average pace', value: formatAveragePace(activity.metrics) },
          { label: 'Elevation gain', value: formatElevation(activity.metrics.elevationGainMeters) },
          { label: 'Elevation loss', value: formatElevation(activity.metrics.elevationLossMeters) },
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

      <ActivityActions activity={activity} anchor={menuAnchor} onCloseMenu={() => setMenuAnchor(null)} />
    </>
  )
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 18, fontWeight: '700', flex: 1 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summary: { fontSize: 13, flexShrink: 1 },
  comments: { fontSize: 14, lineHeight: 20 },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 },
  linkLabel: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
})
