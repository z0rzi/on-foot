import * as Location from 'expo-location'
import { activitiesRepository } from '../data/activities'
import { RECORDING_TASK } from './locationTask'
import { RECORDING_OPTIONS } from './options'
import { useRecordingStore } from './recordingStore'
import { resumeActionFor, ResumeAction } from './resume'
import { toTrackPoint } from './track'

export type StartResult = 'started' | 'permission-denied' | 'already-active'

export async function startRecording(): Promise<StartResult> {
  const existing = await activitiesRepository.getActiveSession()
  if (existing) return 'already-active'
  const foreground = await Location.requestForegroundPermissionsAsync()
  if (!foreground.granted) return 'permission-denied'
  const background = await Location.requestBackgroundPermissionsAsync()
  if (!background.granted) return 'permission-denied'

  const startedAt = Date.now()
  const sessionId = await activitiesRepository.startSession(startedAt)
  useRecordingStore.getState().beginSession({ id: sessionId, startedAt, endedAt: null, linkedTrailId: null, pausedAt: null, pausedMs: 0 })
  await Location.startLocationUpdatesAsync(RECORDING_TASK, RECORDING_OPTIONS)
  return 'started'
}

export async function stopRecording(linkedTrailId: number | null): Promise<void> {
  const session = await activitiesRepository.getActiveSession()
  if (await Location.hasStartedLocationUpdatesAsync(RECORDING_TASK)) {
    await Location.stopLocationUpdatesAsync(RECORDING_TASK)
  }
  if (session && session.endedAt == null) {
    const endedAt = Date.now()
    await activitiesRepository.markStopped(session.id, endedAt, linkedTrailId)
    useRecordingStore.getState().setSession({ ...session, endedAt, linkedTrailId })
  }
}

export async function discardRecording(sessionId: number): Promise<void> {
  if (await Location.hasStartedLocationUpdatesAsync(RECORDING_TASK)) {
    await Location.stopLocationUpdatesAsync(RECORDING_TASK)
  }
  await activitiesRepository.discardSession(sessionId)
  useRecordingStore.getState().reset()
}

export async function resumeIfActive(): Promise<{ action: ResumeAction; sessionId: number | null }> {
  const session = await activitiesRepository.getActiveSession()
  const action = resumeActionFor(session)
  if (action === 'resume' && session) {
    const points = await activitiesRepository.getSessionPoints(session.id)
    useRecordingStore.getState().hydrate(session, points)
    if (!(await Location.hasStartedLocationUpdatesAsync(RECORDING_TASK))) {
      await Location.startLocationUpdatesAsync(RECORDING_TASK, RECORDING_OPTIONS)
    }
    // Append an immediate fix so the overlay bridges the dead gap with a straight line to the
    // current position. Non-fatal: if no fix is available, the next background batch connects it.
    try {
      const now = await Location.getCurrentPositionAsync({ accuracy: RECORDING_OPTIONS.accuracy })
      const point = toTrackPoint(now)
      await activitiesRepository.appendPoints(session.id, [point])
      useRecordingStore.getState().appendLivePoints([point])
    } catch {
      // No immediate fix available; the next background batch will connect the gap.
    }
  } else if (action === 'save' && session) {
    // Reflect the stopped session so phase derives to 'saving' — the save page reads its own
    // points from the DB, so the live geometry is not needed here.
    useRecordingStore.getState().hydrate(session, [])
  }
  return { action, sessionId: session?.id ?? null }
}
