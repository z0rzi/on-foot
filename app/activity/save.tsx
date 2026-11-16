import { useEffect, useState } from 'react'
import { Alert } from 'react-native'
import { activityMetricsFromSegments, lastTrackPoint } from '../../src/data/activities/mapping'
import { discardRecording } from '../../src/recording/recordingController'
import { loadRecording, saveRecording, type LoadedRecording } from '../../src/recording/mapRecording'
import { ActivityForm } from '../../src/activities/ActivityForm'
import { useReturnToMap } from '../../src/components/useReturnToMap'
import { LoadingScreen } from '../../src/components/LoadingScreen'
import { showToast } from '../../src/components/toast'
import { errorClass, logEvent } from '../../src/log'

export default function SaveActivityScreen() {
  const goToMap = useReturnToMap()

  const [recording, setRecording] = useState<LoadedRecording | null>(null)

  useEffect(() => {
    let active = true
    void loadRecording()
      .then((loaded) => {
        if (!active) return
        // No active session is the normal path back from a save or a discard elsewhere, not a failure.
        if (!loaded) {
          goToMap()
          return
        }
        setRecording(loaded)
      })
      .catch((err: unknown) => {
        // Logged before the liveness check: a rejection that lands after unmount still happened.
        logEvent('error', 'error', 'save screen load failed', { errorClass: errorClass(err) })
        if (!active) return
        Alert.alert('Could not open this recording', 'Something went wrong. Please try again.')
        goToMap()
      })
    return () => {
      active = false
    }
  }, [goToMap])

  if (!recording) return <LoadingScreen />

  const { session, segments } = recording
  const endedAt = session.pausedAt ?? lastTrackPoint(segments)?.t ?? session.startedAt
  const metrics = activityMetricsFromSegments(segments, session.startedAt, endedAt, session.pausedMs)

  return (
    <ActivityForm
      metrics={metrics}
      initialName=""
      initialEffort={null}
      initialComments=""
      onSave={async ({ name, effort, comments }) => {
        await saveRecording(recording, { name, effort, comments })
        goToMap()
        showToast('Activity saved')
      }}
      onDiscard={async () => {
        await discardRecording(session.id)
        goToMap()
        showToast('Recording discarded')
      }}
    />
  )
}
