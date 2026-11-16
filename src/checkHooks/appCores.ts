import { deleteActivity } from '../activities/deleteActivity'
import { showActivity } from '../activities/showActivity'
import { installedBuild } from '../log'
import { useOfflineStore } from '../map/offline/offlineStore'
import { mapMode } from '../map/mapMode'
import type { OfflineController } from '../map/provider/types'
import { loadRecording, saveRecording, startFromMap, stopForSave } from '../recording/mapRecording'
import { checkForCapture, discardRecording, pauseRecording, resumeRecording } from '../recording/recordingController'
import { currentRecordingPhase, useRecordingStore } from '../recording/recordingStore'
import { useActivitiesStore } from '../store/activitiesStore'
import { useMapStore } from '../store/mapStore'
import { useTrailsStore } from '../store/trailsStore'
import { deleteTrail } from '../trails/deleteTrail'
import { importTrail } from '../trails/importTrail'
import { showTrail } from '../trails/showTrail'
import { agentSessionRecord } from './agentSession'
import { fileUri, hookFolderPath } from './hookFolder'
import type { Cores } from './hooks'
import { stillLoading } from './readiness'
import { takeSnapshot } from './snapshot'
import type { Loading } from './reply'

// The app's cores for the hooks; a trail's delete takes the map's offline controller, as the screen's does.
export function appCores(controller: OfflineController): Cores {
  return {
    readState: () => {
      const { selection, followMode } = useMapStore.getState()
      const recording = currentRecordingPhase()
      return {
        selection,
        mapMode: mapMode({ recording: recording !== 'idle', selection }),
        followMode,
        recording,
        build: installedBuild(),
      }
    },
    recordingPhase: currentRecordingPhase,
    listed: (kind) => (kind === 'trail' ? useTrailsStore.getState().trails : useActivitiesStore.getState().activities),
    showTrail,
    showActivity,
    clearSelection: () => useMapStore.getState().clearSelection(),
    takeSnapshot,
    deleteItem: async (kind, id) => {
      if (kind === 'trail') await deleteTrail(controller, id)
      else await deleteActivity(id)
    },
    importTrail: async ({ file, name, difficulty }) => importTrail({ uri: fileUri(`${hookFolderPath()}/${file}`), name, difficulty }),
    liveSession: () => {
      const { session } = useRecordingStore.getState()
      return session && { id: session.id, paused: session.pausedAt != null }
    },
    agentSession: agentSessionRecord,
    startRecording: () => startFromMap(checkForCapture),
    pauseRecording,
    resumeRecording: () => resumeRecording(checkForCapture),
    discardRecording,
    stopForSave,
    loadRecording,
    saveRecording,
  }
}

export function loadingNow(): Loading[] {
  return stillLoading({
    launchResolved: useMapStore.getState().launchResolved,
    trails: useTrailsStore.getState().loaded,
    activities: useActivitiesStore.getState().loaded,
    offlinePacks: useOfflineStore.getState().loaded,
    resumeSettled: useRecordingStore.getState().resumeSettled,
  })
}
