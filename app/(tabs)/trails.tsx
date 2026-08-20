import { useCallback, useState } from 'react'
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { useTrailsStore } from '../../src/store/trailsStore'
import { TrailListItem } from '../../src/trails/TrailListItem'
import { useTheme } from '../../src/theme/useTheme'
import { TrailSummary } from '../../src/data/trails/types'

export default function TrailsScreen() {
  const c = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const trails = useTrailsStore((s) => s.trails)
  const loadTrails = useTrailsStore((s) => s.loadTrails)
  const removeTrail = useTrailsStore((s) => s.removeTrail)
  const [pending, setPending] = useState(false)

  useFocusEffect(useCallback(() => { loadTrails() }, [loadTrails]))

  const confirmDelete = useCallback(
    (trail: TrailSummary) => {
      Alert.alert(
        'Delete Trail',
        `Are you sure you want to delete "${trail.name}"? This action cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              setPending(true)
              try {
                await removeTrail(trail.id)
              } finally {
                setPending(false)
              }
            },
          },
        ],
      )
    },
    [removeTrail],
  )

  return (
    <View style={[styles.screen, { backgroundColor: c.background, paddingTop: insets.top }]}>
      <Text style={[styles.title, { color: c.onSurface }]}>Trails</Text>
      {trails.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ color: c.onSurfaceVariant, fontSize: 16 }}>No trails saved yet.</Text>
        </View>
      ) : (
        <FlatList
          data={trails}
          keyExtractor={(t) => String(t.id)}
          renderItem={({ item }) => <TrailListItem trail={item} onDelete={() => confirmDelete(item)} />}
          contentContainerStyle={styles.list}
        />
      )}
      <View style={{ padding: 16, paddingBottom: insets.bottom + 16 }}>
        <Pressable
          accessibilityLabel="Add a GPX file"
          disabled={pending}
          onPress={() => router.push('/trail/new')}
          style={[styles.addButton, { backgroundColor: c.controlAccent, opacity: pending ? 0.6 : 1 }]}
        >
          <Text style={[styles.addLabel, { color: c.surface }]}>Add a GPX file</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  title: { fontSize: 28, fontWeight: '700', paddingHorizontal: 16, paddingVertical: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { gap: 8, paddingVertical: 8 },
  addButton: { borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  addLabel: { fontSize: 16, fontWeight: '700' },
})
