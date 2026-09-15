import { activitiesRepository } from '../data/activities'
import {
  isLocationAvailable,
  requestBackgroundAccess,
  requestForegroundAccess,
  startBackgroundTracking,
  stopBackgroundTracking,
} from '../location'
import { RECORDING_OPTIONS } from './options'
import { useRecordingStore } from './recordingStore'
import { resumeActionFor, ResumeAction } from './resume'
import { applyPause, applyResume } from './session'

export type StartResult = 'started' | 'permission-denied' | 'already-active'

// A durable session must never claim to be recording while nothing is streaming: that state shows a
// live recording capturing no points, and the singleton row blocks starting a real one. Paused is
// the safe state, so pause commits before stopping the stream and resume starts the stream before
// committing — a mismatch in the surviving direction only wastes battery, because the background
// task ignores fixes while pausedAt is set. Start has no safe state to fall back on, so it undoes
// the session instead.

export async function startRecording(): Promise<StartResult> {
  const existing = await activitiesRepository.getActiveSession()
  if (existing) return 'already-active'
  if (!(await requestForegroundAccess())) return 'permission-denied'
  if (!(await requestBackgroundAccess())) return 'permission-denied'

  const startedAt = Date.now()
  const sessionId = await activitiesRepository.startSession(startedAt)
  useRecordingStore.getState().beginSession({ id: sessionId, startedAt, linkedTrailId: null, pausedAt: null, pausedMs: 0, currentSegment: 0 })
  try {
    await startBackgroundTracking(RECORDING_OPTIONS)
  } catch (error) {
    // With nothing streaming, the session is a phantom: the UI would show a recording that captures
    // no points, and the singleton row would answer every retry with 'already-active'. The store is
    // reset first because it cannot fail; if the delete does, the surviving row still reaches the
    // save screen through that same 'already-active' path, where it can be discarded.
    useRecordingStore.getState().reset()
    await activitiesRepository.discardSession(sessionId).catch(() => {})
    throw error
  }
  return 'started'
}

export async function pauseRecording(): Promise<void> {
  const session = await activitiesRepository.getActiveSession()
  if (!session || session.pausedAt != null) return
  const now = Date.now()
  await activitiesRepository.markPaused(session.id, now)
  useRecordingStore.getState().setSession(applyPause(session, now))
  // The pause is already durable and the background task drops fixes whenever pausedAt is set, so
  // failing to stop the stream costs battery, not correctness — it must not fail the pause.
  try {
    await stopBackgroundTracking()
  } catch {
    // Left running; the next pause, discard or launch stops it.
  }
}

export async function resumeRecording(): Promise<void> {
  const session = await activitiesRepository.getActiveSession()
  if (!session || session.pausedAt == null) return
  await startBackgroundTracking(RECORDING_OPTIONS)
  const next = applyResume(session, Date.now())
  await activitiesRepository.markResumed(session.id, next.pausedMs, next.currentSegment)
  useRecordingStore.getState().setSession(next)
}

export async function linkTrailForSave(linkedTrailId: number | null): Promise<void> {
  const session = await activitiesRepository.getActiveSession()
  if (!session) return
  await activitiesRepository.markLinkedTrail(session.id, linkedTrailId)
  useRecordingStore.getState().setSession({ ...session, linkedTrailId })
}

export async function discardRecording(sessionId: number): Promise<void> {
  await stopBackgroundTracking()
  await activitiesRepository.discardSession(sessionId)
  useRecordingStore.getState().reset()
}

export async function resumeIfActive(): Promise<{ action: ResumeAction; sessionId: number | null }> {
  const session = await activitiesRepository.getActiveSession()
  const action = resumeActionFor(session)
  if (session && action !== 'none') {
    const points = await activitiesRepository.getSessionPoints(session.id)
    useRecordingStore.getState().hydrate(session, points)
  }
  if (action === 'resume' && (await isLocationAvailable())) {
    await startBackgroundTracking(RECORDING_OPTIONS)
  }
  return { action, sessionId: session?.id ?? null }
}
