import { activitiesRepository } from '../data/activities'
import {
  hasForegroundAccess,
  isLocationAvailable,
  promptToEnableLocation,
  requestBackgroundAccess,
  requestForegroundAccess,
  startBackgroundTracking,
  stopBackgroundTracking,
} from '../location'
import { isAppActive, whenAppActive } from './appActivity'
import { ensureTrackingNotificationAccess } from './notificationAccess'
import { RECORDING_OPTIONS } from './options'
import { useRecordingStore } from './recordingStore'
import { resumeActionFor, ResumeAction } from './resume'
import { applyPause, applyResume } from './session'

export type StartResult = 'started' | 'permission-denied' | 'already-active' | 'location-off'

// The durable session is the recording; the location stream is how it captures. They can disagree
// in ways the app observes — location off, a refused start, a missing permission — and the store
// records each so the sheet shows it instead of a confident "Recording". Every operation that reads
// or changes the session or the stream runs as one turn of a single chain, so none interleaves with
// another. A start issued with no location provider available makes no request, and on a registered
// task it destroys the live one, so starts are issued only while a provider is available. A live
// request survives location being switched off and on, so it is re-issued only when no start is
// known to be live.

let tail: Promise<unknown> = Promise.resolve()

function exclusive<T>(operation: () => Promise<T>): Promise<T> {
  const turn = tail.then(operation, operation)
  tail = turn.catch(() => {})
  return turn
}

async function issueStream(): Promise<void> {
  try {
    await startBackgroundTracking(RECORDING_OPTIONS)
  } catch {
    useRecordingStore.getState().setStreamState({
      streamLive: false,
      captureFault: isAppActive() ? 'start-failed' : null,
    })
    return
  }
  const available = await isLocationAvailable()
  useRecordingStore.getState().setStreamState({ streamLive: available, locationAvailable: available, captureFault: null })
}

// Prompts run before the turn is queued: a dialog that never answers must not hold pause, resume or
// discard behind it.
export async function startRecording(): Promise<StartResult> {
  if (await activitiesRepository.getActiveSession()) return 'already-active'
  if (!(await requestForegroundAccess())) return 'permission-denied'
  if (!(await requestBackgroundAccess())) return 'permission-denied'
  if (!(await isLocationAvailable()) && !(await promptToEnableLocation())) return 'location-off'
  await ensureTrackingNotificationAccess()
  await whenAppActive()
  return exclusive<StartResult>(async () => {
    if (await activitiesRepository.getActiveSession()) return 'already-active'
    const startedAt = Date.now()
    const sessionId = await activitiesRepository.startSession(startedAt)
    useRecordingStore.getState().beginSession({ id: sessionId, startedAt, linkedTrailId: null, pausedAt: null, pausedMs: 0, currentSegment: 0 })
    await issueStream()
    return 'started'
  })
}

export function pauseRecording(): Promise<void> {
  return exclusive(async () => {
    const session = await activitiesRepository.getActiveSession()
    if (!session || session.pausedAt != null) return
    const now = Date.now()
    await activitiesRepository.markPaused(session.id, now)
    const store = useRecordingStore.getState()
    store.setSession(applyPause(session, now))
    store.setStreamState({ streamLive: false })
    // The pause is already durable and the background task drops fixes whenever pausedAt is set, so
    // failing to stop the stream costs battery, not correctness — it must not fail the pause.
    try {
      await stopBackgroundTracking()
    } catch {
      // Left running; the next launch stops it.
    }
  })
}

// A resumed session is visibly recording whether or not its stream starts, so a refused start is a
// capture fault the sheet shows, not a failed resume.
export function resumeRecording(): Promise<void> {
  return exclusive(async () => {
    const session = await activitiesRepository.getActiveSession()
    if (!session || session.pausedAt == null) return
    const next = applyResume(session, Date.now())
    await activitiesRepository.markResumed(session.id, next.pausedMs, next.currentSegment)
    useRecordingStore.getState().setSession(next)
    const available = await isLocationAvailable()
    useRecordingStore.getState().setStreamState({ locationAvailable: available })
    if (available) await issueStream()
  })
}

export function linkTrailForSave(linkedTrailId: number | null): Promise<void> {
  return exclusive(async () => {
    const session = await activitiesRepository.getActiveSession()
    if (!session) return
    await activitiesRepository.markLinkedTrail(session.id, linkedTrailId)
    useRecordingStore.getState().setSession({ ...session, linkedTrailId })
  })
}

export function discardRecording(sessionId: number): Promise<void> {
  return exclusive(async () => {
    await stopBackgroundTracking()
    await activitiesRepository.discardSession(sessionId)
    useRecordingStore.getState().reset()
  })
}

let recoveryQueued = false

// Safe to call from any event: it starts a stream only when the session records, foreground
// permission is held, a provider is available and no start is known to be live. At most one
// recovery waits in the chain; triggers that arrive meanwhile are covered by it.
export function ensureStreaming(): Promise<void> {
  if (recoveryQueued) return Promise.resolve()
  recoveryQueued = true
  return exclusive(async () => {
    recoveryQueued = false
    const session = await activitiesRepository.getActiveSession()
    if (!session || session.pausedAt != null) return
    if (!(await hasForegroundAccess())) {
      useRecordingStore.getState().setStreamState({ captureFault: 'permission-missing' })
      return
    }
    if (useRecordingStore.getState().captureFault === 'permission-missing') {
      useRecordingStore.getState().setStreamState({ captureFault: null })
    }
    const available = await isLocationAvailable()
    useRecordingStore.getState().setStreamState({ locationAvailable: available })
    if (!available || useRecordingStore.getState().streamLive) return
    await issueStream()
  })
}

export function resumeIfActive(): Promise<{ action: ResumeAction; sessionId: number | null }> {
  return exclusive(async () => {
    const session = await activitiesRepository.getActiveSession()
    const action = resumeActionFor(session)
    if (session && action !== 'none') {
      const points = await activitiesRepository.getSessionPoints(session.id)
      useRecordingStore.getState().hydrate(session, points)
    }
    if (action === 'resume' && (await isLocationAvailable())) {
      await issueStream()
    }
    return { action, sessionId: session?.id ?? null }
  })
}
