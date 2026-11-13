import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useActivitiesStore } from '../store/activitiesStore'
import { familiesByTrail } from '../data/activities/family'
import { ActivityListItem } from './ActivityListItem'
import { useTheme } from '../theme/useTheme'
import { formatCompleted } from '../trails/format'

// A trail's family activities on its card and on a linked activity's card, the shown activity's
// row marked. Absent while the trail has none.
export function FamilyList({
  trailId,
  shownActivityId,
  onSelectActivity,
}: {
  trailId: number
  shownActivityId?: number
  onSelectActivity: (id: number) => void
}) {
  const c = useTheme()
  const activities = useActivitiesStore((s) => s.activities)
  const family = useMemo(() => familiesByTrail(activities).get(trailId) ?? [], [activities, trailId])
  if (family.length === 0) return null

  return (
    <View style={styles.list}>
      <Text style={[styles.heading, { color: c.panelContent }]}>{formatCompleted(family.length)}</Text>
      {family.map((activity) => (
        <ActivityListItem
          key={activity.id}
          variant="compact"
          inFamily
          selected={activity.id === shownActivityId}
          activity={activity}
          onSelect={onSelectActivity}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  heading: { fontSize: 15, fontWeight: '700' },
})
