import { useCallback, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import * as DocumentPicker from 'expo-document-picker'
import { useTrailsStore } from '../../src/store/trailsStore'
import { useMapStore } from '../../src/store/mapStore'
import { useOfflineController } from '../../src/map/provider'
import { useOfflineStore } from '../../src/map/offline/offlineStore'
import { TrailListItem } from '../../src/trails/TrailListItem'
import { ListScreen } from '../../src/components/ListScreen'
import { useTheme } from '../../src/theme/useTheme'
import { TrailSummary } from '../../src/data/trails/types'
import { logEvent } from '../../src/log'

export default function TrailsScreen() {
  const c = useTheme()
  const router = useRouter()
  const trails = useTrailsStore((s) => s.trails)
  const loadTrails = useTrailsStore((s) => s.loadTrails)
  const removeTrail = useTrailsStore((s) => s.removeTrail)
  const select = useMapStore((s) => s.select)
  const offlineController = useOfflineController()
  const removeForTrail = useOfflineStore((s) => s.removeForTrail)
  const [pending, setPending] = useState(false)

  useFocusEffect(useCallback(() => { void loadTrails() }, [loadTrails]))

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
            onPress: () => {
              void (async () => {
                setPending(true)
                try {
                  await removeForTrail(offlineController, trail.id)
                  await removeTrail(trail.id)
                } catch (error) {
                  logEvent('error', 'error', 'deleting the trail failed', { error: String(error) })
                  Alert.alert('Could not delete', 'Something went wrong deleting this trail. Please try again.')
                } finally {
                  setPending(false)
                }
              })()
            },
          },
        ],
      )
    },
    [offlineController, removeForTrail, removeTrail],
  )

  const onSelect = useCallback(
    (id: number) => {
      select('trail', id)
      router.navigate('/')
    },
    [select, router],
  )

  const pickGpx = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/gpx+xml', 'application/octet-stream', 'application/xml', 'text/xml', '*/*'],
      copyToCacheDirectory: true,
    })
    if (result.canceled) return
    const asset = result.assets[0]
    const fallback = asset.name?.replace(/\.[^.]+$/, '')
    router.push({ pathname: '/trail/new', params: { uri: asset.uri, name: fallback ?? '' } })
  }, [router])

  return (
    <ListScreen
      title="Trails"
      items={trails}
      keyOf={(t) => String(t.id)}
      emptyMessage="No trails saved yet."
      renderItem={(trail) => (
        <TrailListItem trail={trail} onSelect={onSelect} onEdit={(id) => router.push(`/trail/${id}/edit`)} onDelete={() => confirmDelete(trail)} />
      )}
      footer={
        <Pressable
          accessibilityLabel="Add a GPX file"
          disabled={pending}
          onPress={pickGpx}
          style={[styles.addButton, { backgroundColor: c.controlAccent, opacity: pending ? 0.6 : 1 }]}
        >
          <Text style={[styles.addLabel, { color: c.onControlAccent }]}>Add a GPX file</Text>
        </Pressable>
      }
    />
  )
}

const styles = StyleSheet.create({
  addButton: { borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  addLabel: { fontSize: 16, fontWeight: '700' },
})
