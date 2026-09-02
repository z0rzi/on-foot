import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { RecordingSession, TrackPoint, activitiesRepository } from '../../src/data/activities'
import { activityMetricsFromSegments, buildNewActivityInput, groupPointsBySegment, lastTrackPoint } from '../../src/data/activities/mapping'
import { useActivitiesStore } from '../../src/store/activitiesStore'
import { discardRecording } from '../../src/recording/recordingController'
import { useRecordingStore } from '../../src/recording/recordingStore'
import { ActivityForm } from '../../src/activities/ActivityForm'
import { useTheme } from '../../src/theme/useTheme'

export default function SaveActivityScreen() {
  const c = useTheme()
  const router = useRouter()
  const saveActivity = useActivitiesStore((s) => s.saveActivity)
  const resetRecording = useRecordingStore((s) => s.reset)

  // This screen is pushed over the map, so return by popping back to the existing map instance —
  // replacing the root would mount a second map on top of the live one (stacking, camera reset).
  // The replace fallback only matters if there is somehow no history to pop.
  const goToMap = () => (router.canGoBack() ? router.back() : router.replace('/'))

  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<RecordingSession | null>(null)
  const [segments, setSegments] = useState<TrackPoint[][]>([])

  useEffect(() => {
    let active = true
    void activitiesRepository.getActiveSession().then(async (loaded) => {
      if (!active) return
      if (!loaded) {
        goToMap()
        return
      }
      const loadedPoints = await activitiesRepository.getSessionPoints(loaded.id)
      if (!active) return
      setSession(loaded)
      setSegments(groupPointsBySegment(loadedPoints))
      setLoading(false)
    })
    return () => { active = false }
  }, [router])

  if (loading || !session) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <ActivityIndicator size="large" color={c.controlAccent} />
      </View>
    )
  }

  const endedAt = session.pausedAt ?? lastTrackPoint(segments)?.t ?? session.startedAt
  const metrics = activityMetricsFromSegments(segments, session.startedAt, endedAt, session.pausedMs)

  return (
    <ActivityForm
      metrics={metrics}
      initialName=""
      initialEffort={null}
      initialComments=""
      onSave={async ({ name, effort, comments }) => {
        await saveActivity(session.id, buildNewActivityInput(session, segments, { name, effort, comments }))
        resetRecording()
        goToMap()
      }}
      onDiscard={async () => {
        await discardRecording(session.id)
        goToMap()
      }}
    />
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})
