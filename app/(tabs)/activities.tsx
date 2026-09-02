import { useCallback } from 'react'
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { useActivitiesStore } from '../../src/store/activitiesStore'
import { useMapStore } from '../../src/store/mapStore'
import { useRecordingStore, recordingPhase } from '../../src/recording/recordingStore'
import { ActivityListItem } from '../../src/activities/ActivityListItem'
import { useTheme } from '../../src/theme/useTheme'
import { ActivitySummary } from '../../src/data/activities/types'

export default function ActivitiesScreen() {
  const c = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const activities = useActivitiesStore((s) => s.activities)
  const loadActivities = useActivitiesStore((s) => s.loadActivities)
  const removeActivity = useActivitiesStore((s) => s.removeActivity)
  const select = useMapStore((s) => s.select)
  const clearSelection = useMapStore((s) => s.clearSelection)

  useFocusEffect(useCallback(() => { void loadActivities() }, [loadActivities]))

  const onSelect = useCallback(
    (id: number) => {
      if (recordingPhase(useRecordingStore.getState().session) !== 'idle') return
      select('activity', id)
      router.navigate('/')
    },
    [select, router],
  )

  const confirmDelete = useCallback(
    (activity: ActivitySummary) => {
      Alert.alert(
        'Delete Activity',
        `Are you sure you want to delete "${activity.name}"? This action cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              const sel = useMapStore.getState().selection
              if (sel?.kind === 'activity' && sel.id === activity.id) clearSelection()
              void removeActivity(activity.id)
            },
          },
        ],
      )
    },
    [removeActivity, clearSelection],
  )

  return (
    <View style={[styles.screen, { backgroundColor: c.background, paddingTop: insets.top }]}>
      <Text style={[styles.title, { color: c.onSurface }]}>Activities</Text>
      {activities.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ color: c.onSurfaceVariant, fontSize: 16 }}>No activities recorded yet.</Text>
        </View>
      ) : (
        <FlatList
          data={activities}
          keyExtractor={(a) => String(a.id)}
          renderItem={({ item }) => (
            <ActivityListItem activity={item} onSelect={onSelect} onDelete={() => confirmDelete(item)} />
          )}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  title: { fontSize: 28, fontWeight: '700', paddingHorizontal: 16, paddingVertical: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { gap: 8, paddingVertical: 8 },
})
