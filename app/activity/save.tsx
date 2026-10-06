import { useEffect, useState } from 'react'
import { Alert } from 'react-native'
import { RecordingSession, TrackPoint, activitiesRepository } from '../../src/data/activities'
import { activityMetricsFromSegments, buildNewActivityInput, groupPointsBySegment, lastTrackPoint } from '../../src/data/activities/mapping'
import { discardRecording, finishRecording } from '../../src/recording/recordingController'
import { ActivityForm } from '../../src/activities/ActivityForm'
import { useGoBackOrHome } from '../../src/components/useGoBackOrHome'
import { ScreenHeader } from '../../src/components/ScreenHeader'
import { LoadingScreen } from '../../src/components/LoadingScreen'
import { logEvent } from '../../src/log'

export default function SaveActivityScreen() {
  // This screen is pushed over the map, so return by popping back to the existing map instance —
  // replacing the root would mount a second map on top of the live one (stacking, camera reset).
  const goToMap = useGoBackOrHome()

  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<RecordingSession | null>(null)
  const [segments, setSegments] = useState<TrackPoint[][]>([])

  useEffect(() => {
    let active = true
    void activitiesRepository
      .getActiveSession()
      .then(async (loaded) => {
        if (!active) return
        // No active session is the normal path back from a save or a discard elsewhere, not a failure.
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
      .catch((err: unknown) => {
        // Logged before the liveness check: a rejection that lands after unmount still happened.
        logEvent('error', 'error', 'save screen load failed', { error: String(err) })
        if (!active) return
        Alert.alert('Could not open this recording', 'Something went wrong. Please try again.')
        goToMap()
      })
    return () => {
      active = false
    }
  }, [goToMap])

  if (loading || !session) return <LoadingScreen />

  const endedAt = session.pausedAt ?? lastTrackPoint(segments)?.t ?? session.startedAt
  const metrics = activityMetricsFromSegments(segments, session.startedAt, endedAt, session.pausedMs)

  return (
    <>
      <ScreenHeader title="Save activity" />
      <ActivityForm
        metrics={metrics}
        initialName=""
        initialEffort={null}
        initialComments=""
        onSave={async ({ name, effort, comments }) => {
          await finishRecording(session.id, buildNewActivityInput(session, segments, { name, effort, comments }))
          goToMap()
        }}
        onDiscard={async () => {
          await discardRecording(session.id)
          goToMap()
        }}
      />
    </>
  )
}
