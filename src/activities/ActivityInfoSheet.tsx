import { useState } from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { ActivityWithLinkedTrail } from './linkedTrail'
import { useTheme } from '../theme/useTheme'
import { effortField } from './effort'
import { activityMetricTiles, formatActivityDate } from './format'
import { MetricsGrid } from '../components/MetricsGrid'
import type { MenuAnchor } from '../components/ActionsMenu'
import { CardSummaryRow, CardTitleRow } from '../components/CardRows'
import { ActivityActions } from './ActivityActions'
import { FamilyList } from './FamilyList'

export function ActivityInfoSheet({
  activity,
  onViewLinkedTrail,
  onSelectActivity,
}: {
  activity: ActivityWithLinkedTrail
  onViewLinkedTrail: (trailId: number) => void
  onSelectActivity: (id: number) => void
}) {
  const c = useTheme()
  const { linkedTrail } = activity
  const [menuAnchor, setMenuAnchor] = useState<MenuAnchor | null>(null)

  return (
    <>
      <CardTitleRow name={activity.name} actions={{ accessibilityLabel: 'Activity actions', onOpen: setMenuAnchor }} />
      <CardSummaryRow
        badge={{ field: effortField, value: activity.effort }}
        text={formatActivityDate(activity.startedAt)}
      />

      <MetricsGrid items={activityMetricTiles(activity.metrics, 'card')} />

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

      {linkedTrail && (
        <FamilyList trailId={linkedTrail.id} shownActivityId={activity.id} onSelectActivity={onSelectActivity} />
      )}

      <ActivityActions activity={activity} anchor={menuAnchor} onCloseMenu={() => setMenuAnchor(null)} />
    </>
  )
}

const styles = StyleSheet.create({
  comments: { fontSize: 14, lineHeight: 20 },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 },
  linkLabel: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
})
