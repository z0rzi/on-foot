import * as Location from 'expo-location'
import { activitiesRepository } from '../data/activities'
import { RECORDING_TASK } from './locationTask'
import { RECORDING_OPTIONS } from './options'
import { useRecordingStore } from './recordingStore'
import { resumeActionFor, ResumeAction } from './resume'
import { applyPause, applyResume } from './session'
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
  useRecordingStore.getState().beginSession({ id: sessionId, startedAt, linkedTrailId: null, pausedAt: null, pausedMs: 0, currentSegment: 0 })
  await Location.startLocationUpdatesAsync(RECORDING_TASK, RECORDING_OPTIONS)
  return 'started'
}

export async function pauseRecording(): Promise<void> {
  const session = await activitiesRepository.getActiveSession()
  if (!session || session.pausedAt != null) return
  if (await Location.hasStartedLocationUpdatesAsync(RECORDING_TASK)) {
    await Location.stopLocationUpdatesAsync(RECORDING_TASK)
  }
  const now = Date.now()
  await activitiesRepository.markPaused(session.id, now)
  useRecordingStore.getState().setSession(applyPause(session, now))
}

export async function resumeRecording(): Promise<void> {
  const session = await activitiesRepository.getActiveSession()
  if (!session || session.pausedAt == null) return
  const next = applyResume(session, Date.now())
  await activitiesRepository.markResumed(session.id, next.pausedMs, next.currentSegment)
  useRecordingStore.getState().setSession(next)
  useRecordingStore.getState().startSegment()
  if (!(await Location.hasStartedLocationUpdatesAsync(RECORDING_TASK))) {
    await Location.startLocationUpdatesAsync(RECORDING_TASK, RECORDING_OPTIONS)
  }
}

export async function stopToSave(linkedTrailId: number | null): Promise<void> {
  const session = await activitiesRepository.getActiveSession()
  if (!session) return
  await activitiesRepository.markLinkedTrail(session.id, linkedTrailId)
  useRecordingStore.getState().setSession({ ...session, linkedTrailId })
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
    const segments = await activitiesRepository.getSessionSegments(session.id)
    useRecordingStore.getState().hydrate(session, segments)
    if (session.currentSegment + 1 > segments.length) {
      useRecordingStore.getState().startSegment()
    }
    if (!(await Location.hasStartedLocationUpdatesAsync(RECORDING_TASK))) {
      await Location.startLocationUpdatesAsync(RECORDING_TASK, RECORDING_OPTIONS)
    }
    // Append an immediate fix so the overlay bridges the dead gap with a straight line to the
    // current position. Non-fatal: if no fix is available, the next background batch connects it.
    try {
      const now = await Location.getCurrentPositionAsync({ accuracy: RECORDING_OPTIONS.accuracy })
      const point = toTrackPoint(now)
      await activitiesRepository.appendPoints(session.id, session.currentSegment, [point])
      useRecordingStore.getState().appendLivePoints([point])
    } catch {
      // No immediate fix available; the next background batch will connect the gap.
    }
  } else if (action === 'paused' && session) {
    const segments = await activitiesRepository.getSessionSegments(session.id)
    useRecordingStore.getState().hydrate(session, segments)
  }
  return { action, sessionId: session?.id ?? null }
}
