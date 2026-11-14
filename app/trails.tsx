import { useCallback } from 'react'
import { Alert, Pressable, StyleSheet, Text } from 'react-native'
import { useRouter } from 'expo-router'
import * as DocumentPicker from 'expo-document-picker'
import { useTrailsStore } from '../src/store/trailsStore'
import { TrailListItem } from '../src/trails/TrailListItem'
import { ListScreen } from '../src/components/ListScreen'
import { useTheme } from '../src/theme/useTheme'
import { errorClass, logEvent } from '../src/log'
import { useShowTrail } from '../src/trails/useShowTrail'
import { newTrailHref } from '../src/trails/newTrailHref'
import { useRefreshOnFocus } from '../src/components/useRefreshOnFocus'
import { TRAILS_REFRESH_FAILURE } from '../src/trails/refreshFailure'
import { TrailActions } from '../src/trails/TrailActions'
import { useTrailActionsMenu } from '../src/trails/useTrailActionsMenu'

export default function TrailsScreen() {
  const c = useTheme()
  const router = useRouter()
  const trails = useTrailsStore((s) => s.trails)
  const loadTrails = useTrailsStore((s) => s.loadTrails)
  const showTrail = useShowTrail()
  const actions = useTrailActionsMenu(trails)

  useRefreshOnFocus(loadTrails, TRAILS_REFRESH_FAILURE)

  const onSelect = useCallback(
    (id: number) => {
      const trail = trails.find((t) => t.id === id)
      if (trail) showTrail(trail)
    },
    [trails, showTrail],
  )

  const pickGpx = useCallback(async () => {
    let result: DocumentPicker.DocumentPickerResult
    try {
      result = await DocumentPicker.getDocumentAsync({
        type: ['application/gpx+xml', 'application/octet-stream', 'application/xml', 'text/xml', '*/*'],
        copyToCacheDirectory: true,
      })
    } catch (error) {
      logEvent('error', 'error', 'opening the file picker failed', { errorClass: errorClass(error) })
      Alert.alert('Could not open the file picker', 'Something went wrong opening the file picker. Please try again.')
      return
    }
    if (result.canceled) return
    const asset = result.assets[0]
    const fallback = asset.name?.replace(/\.[^.]+$/, '')
    router.push(newTrailHref(asset.uri, fallback))
  }, [router])

  return (
    <>
      <ListScreen
        items={trails}
        keyOf={(t) => String(t.id)}
        emptyMessage="No trails yet. Add a GPX file, or share one to On Foot from another app."
        renderItem={(trail) => <TrailListItem trail={trail} onSelect={onSelect} onOpenActions={actions.open} />}
        footer={
          <Pressable
            accessibilityLabel="Add a GPX file"
            onPress={pickGpx}
            style={[styles.addButton, { backgroundColor: c.controlAccent }]}
          >
            <Text style={[styles.addLabel, { color: c.onControlAccent }]}>Add a GPX file</Text>
          </Pressable>
        }
      />
      {actions.target && (
        <TrailActions trail={actions.target.trail} anchor={actions.target.anchor} onCloseMenu={actions.closeMenu} />
      )}
    </>
  )
}

const styles = StyleSheet.create({
  addButton: { borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  addLabel: { fontSize: 16, fontWeight: '700' },
})
