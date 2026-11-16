import { activitiesRepository, NewActivityInput, RecordingSession } from '../data/activities'
import {
  hasBackgroundAccess,
  hasForegroundAccess,
  isLocationAvailable,
  promptToEnableLocation,
  requestBackgroundAccess,
  requestForegroundAccess,
  startBackgroundTracking,
  stopBackgroundTracking,
} from '../location'
import { useActivitiesStore } from '../store/activitiesStore'
import { isAppActive, whenAppActive } from './appActivity'
import { ensureTrackingNotificationAccess } from './notificationAccess'
import { RECORDING_OPTIONS } from './options'
import type { InterruptionGap } from './interruption'
import { useRecordingStore } from './recordingStore'
import { lastKnownRecordingAt, resumeActionFor, ResumeAction } from './resume'
import { applyPause, applyRelaunch, applyResume } from './session'
import { createSerialQueue } from '../async/serialQueue'
import { deliveryQueue } from './deliveryQueue'
import { errorClass, logEvent } from '../log'
import { formatClockTime } from '../activities/format'

export type CaptureReadiness = 'ready' | 'permission-denied' | 'location-off'
export type CaptureRefusal = Exclude<CaptureReadiness, 'ready'>
// What a start or a resume that may not prompt finds missing.
export type CaptureCheck = 'ready' | 'permission-missing' | 'location-off' | 'app-behind'
// Decides whether a start or a resume may go ahead, and how it gets there: by prompting, or only by
// checking.
export type CaptureGate<Refusal extends string> = () => Promise<'ready' | Refusal>

// The durable session is the recording; the location stream is how it captures. They can disagree
// in ways the app observes — location off, a refused start, a missing permission — and the store
// records each so the sheet shows it instead of a confident "Recording". Every operation that changes
// the session or the stream runs as one turn of a single chain, so none interleaves with another; the
// pre-turn probes that decide whether to prompt read the session outside a turn, and every turn
// re-reads what it acts on. A start issued with no location provider available makes no request, and on a registered
// task it destroys the live one, so starts are issued only while a provider is available. A live
// request survives location being switched off and on, so it is re-issued only when no start is
// known to be live.

const exclusive = createSerialQueue()

async function issueStream(): Promise<void> {
  try {
    await startBackgroundTracking(RECORDING_OPTIONS)
  } catch (error) {
    logEvent('error', 'capture', 'stream start failed', { errorClass: errorClass(error) })
    useRecordingStore.getState().setStreamState({
      stream: isAppActive() ? { kind: 'faulted', fault: 'start-failed' } : { kind: 'stopped' },
    })
    return
  }
  const available = await isLocationAvailable()
  logEvent(available ? 'info' : 'warn', 'capture', available ? 'stream live' : 'stream stopped, no provider')
  useRecordingStore.getState().setStreamState({
    stream: available ? { kind: 'live' } : { kind: 'stopped' },
    locationAvailable: available,
  })
}

// Reads the current provider availability into the store and reports it, so every caller that must
// know whether a start may be issued sees and records the same fact.
async function refreshAvailability(): Promise<boolean> {
  const available = await isLocationAvailable()
  useRecordingStore.getState().setStreamState({ locationAvailable: available })
  return available
}

async function issueStreamIfAvailable(): Promise<void> {
  if (await refreshAvailability()) await issueStream()
}

// A stream left running costs battery, not correctness: the background task drops fixes for a paused
// session or none, a later resume replaces it, and the next launch stops an orphaned one. So no
// operation fails on a stop that fails. With no stream running it logs nothing.
async function stopStreamTolerant(): Promise<void> {
  let stopped: boolean
  try {
    stopped = await stopBackgroundTracking()
  } catch (error) {
    logEvent('warn', 'capture', 'stream stop failed', { errorClass: errorClass(error) })
    return
  }
  if (stopped) logEvent('info', 'capture', 'stream stopped')
}

// What capturing needs before a session may record: location access and a location provider, or the
// user's acceptance of the prompt to turn one on. It runs before a turn is queued: a dialog that never
// answers must not hold pause, resume or discard behind it.
async function ensureCaptureReady(): Promise<CaptureReadiness> {
  if (!(await requestForegroundAccess())) {
    logEvent('warn', 'capture', 'capture permission-denied', { scope: 'foreground' })
    return 'permission-denied'
  }
  // A recording must go on capturing once the app leaves the foreground, so capturing asks for "All
  // the time" access; recovery only ever restarts a stream while the app is active, so it needs no
  // more than the foreground grant checked in ensureStreaming.
  if (!(await requestBackgroundAccess())) {
    logEvent('warn', 'capture', 'capture permission-denied', { scope: 'background' })
    return 'permission-denied'
  }
  if (!(await isLocationAvailable()) && !(await promptToEnableLocation())) {
    logEvent('warn', 'capture', 'capture location-off')
    return 'location-off'
  }
  logEvent('info', 'capture', 'capture ready')
  return 'ready'
}

// The record button's gate: it asks for what capturing lacks, then for notification access, then
// waits for the app to be in front again after the dialogs.
export async function promptForStart(): Promise<CaptureReadiness> {
  const readiness = await ensureCaptureReady()
  if (readiness !== 'ready') return readiness
  await ensureTrackingNotificationAccess()
  await whenAppActive()
  return 'ready'
}

// The Resume button's gate: it asks for what capturing lacks, then waits for the app to be in front
// again after the dialogs. The notification hint is start's alone, asked once per process.
export async function promptForResume(): Promise<CaptureReadiness> {
  const readiness = await ensureCaptureReady()
  if (readiness !== 'ready') return readiness
  await whenAppActive()
  return 'ready'
}

// A start or a resume that may not prompt: what capturing lacks is a refusal, and so is the app not
// being in front, where a location start is refused.
export async function checkForCapture(): Promise<CaptureCheck> {
  if (!(await hasForegroundAccess()) || !(await hasBackgroundAccess())) return 'permission-missing'
  if (!(await isLocationAvailable())) return 'location-off'
  return isAppActive() ? 'ready' : 'app-behind'
}

export async function startRecording<Refusal extends string>(
  gate: CaptureGate<Refusal>,
): Promise<'started' | 'already-active' | Refusal> {
  if (await activitiesRepository.getActiveSession()) {
    logEvent('warn', 'recording', 'start already-active')
    return 'already-active'
  }
  const readiness = await gate()
  if (readiness !== 'ready') {
    logEvent('warn', 'recording', `start ${readiness}`)
    return readiness
  }
  return exclusive<'started'>(async () => {
    // A session found here belongs to a concurrent tap that reached the turn first: the tap that
    // lost reports the start it asked for, not a pre-existing recording.
    if (await activitiesRepository.getActiveSession()) {
      logEvent('info', 'recording', 'start: a concurrent start won')
      return 'started'
    }
    const startedAt = Date.now()
    const sessionId = await activitiesRepository.startSession(startedAt)
    useRecordingStore.getState().beginSession({
      id: sessionId, startedAt, linkedTrailId: null, pausedAt: null, pausedMs: 0, currentSegment: 0, segmentStartedAt: startedAt,
    })
    await issueStream()
    logEvent('info', 'recording', 'start started')
    return 'started'
  })
}

export function pauseRecording(): Promise<void> {
  return exclusive(async () => {
    const session = await activitiesRepository.getActiveSession()
    if (!session || session.pausedAt != null) {
      logEvent('info', 'recording', session ? 'pause: already paused' : 'pause: no session')
      return
    }
    const now = Date.now()
    await activitiesRepository.markPaused(session.id, now)
    logEvent('info', 'recording', 'paused')
    const store = useRecordingStore.getState()
    store.setSession(applyPause(session, now))
    store.setStreamState({ stream: { kind: 'stopped' } })
    await stopStreamTolerant()
  })
}

// Resuming passes a gate as starting does, so a refusal leaves the session paused. Once resumed, the
// session is visibly recording whether or not its stream starts, so a refused start is a capture fault
// the sheet shows, not a failed resume.
export async function resumeRecording<Refusal extends string>(gate: CaptureGate<Refusal>): Promise<'resumed' | Refusal> {
  const current = await activitiesRepository.getActiveSession()
  if (!current || current.pausedAt == null) {
    logEvent('info', 'recording', current ? 'resume: session not paused' : 'resume: no session')
    return 'resumed'
  }
  const readiness = await gate()
  if (readiness !== 'ready') {
    logEvent('warn', 'recording', `resume ${readiness}`)
    return readiness
  }
  return exclusive<'resumed'>(async () => {
    const session = await activitiesRepository.getActiveSession()
    // Not paused here means a concurrent resume reached the turn first.
    if (!session || session.pausedAt == null) {
      logEvent('info', 'recording', session ? 'resume: a concurrent resume won' : 'resume: session gone')
      return 'resumed'
    }
    const next = applyResume(session, Date.now())
    await activitiesRepository.markResumed(session.id, next.pausedMs, next.currentSegment, next.segmentStartedAt)
    useRecordingStore.getState().setSession(next)
    logEvent('info', 'recording', 'segment began', { segment: next.currentSegment, segmentStartedAt: next.segmentStartedAt })
    await issueStreamIfAvailable()
    logEvent('info', 'recording', 'resume resumed')
    return 'resumed'
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
    useRecordingStore.getState().setStreamState({ stream: { kind: 'stopped' } })
    await stopStreamTolerant()
    await activitiesRepository.discardSession(sessionId)
    logEvent('info', 'recording', 'discarded', { sessionId })
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
      logEvent('warn', 'capture', 'recovery found no location permission')
      useRecordingStore.getState().setStreamState({ stream: { kind: 'faulted', fault: 'permission-missing' } })
      return
    }
    const stream = useRecordingStore.getState().stream
    if (stream.kind === 'faulted' && stream.fault === 'permission-missing') {
      useRecordingStore.getState().setStreamState({ stream: { kind: 'stopped' } })
    }
    if (!(await refreshAvailability()) || useRecordingStore.getState().stream.kind === 'live') {
      logEvent('info', 'capture', 'recovery left the live request alone')
      return
    }
    logEvent('info', 'capture', 'recovery re-issued the stream')
    await issueStream()
  })
}

// When nothing is missing the track goes on in its segment; after a real gap the gap gets its own
// segment and the user is told. Reading the track, cutting and hydrating are one turn of the delivery
// queue, so no delivery is stored unseen in between. Unless paused, capture restarts, which also
// restores the foreground service a restored task never gets.
async function resumeAfterProcessDeath(session: RecordingSession): Promise<ResumeAction> {
  const { action, relaunched, gap } = await deliveryQueue(async () => {
    const points = await activitiesRepository.getSessionPoints(session.id)
    const lastPoint = points.at(-1) ?? null
    const now = Date.now()
    const action = resumeActionFor(session, lastPoint, now)
    const gap: InterruptionGap = { since: lastKnownRecordingAt(session, lastPoint), until: now }
    const relaunched = action === 'resume' ? applyRelaunch(session, gap.since) : session
    if (action === 'resume') {
      await activitiesRepository.markResumed(relaunched.id, relaunched.pausedMs, relaunched.currentSegment, relaunched.segmentStartedAt)
    }
    useRecordingStore.getState().hydrate(relaunched, points)
    return { action, relaunched, gap }
  })
  if (action === 'resume') {
    logEvent('info', 'recording', 'segment began', { segment: relaunched.currentSegment, segmentStartedAt: relaunched.segmentStartedAt })
    logEvent('warn', 'launch', 'detected an interruption', { from: formatClockTime(gap.since), to: formatClockTime(gap.until) })
    useRecordingStore.getState().announceInterruption(gap)
  }
  if (action !== 'paused') await issueStreamIfAvailable()
  return action
}

// What a launch did with the durable session: `none` with no recording, `held` when this runtime
// already shows it and nothing changed, otherwise the relaunch's decision.
type LaunchAction = ResumeAction | 'held'

// A recording row with an empty store means this runtime has not shown the recording: its process
// died while recording, or the app opened onto a runtime that only stored deliveries, since the
// background task never sets the store's session. Swiping the app away only remounts the React root,
// and the store, module state, survives that: a held session is left as it is.
export function resumeIfActive(): Promise<{ action: LaunchAction; sessionId: number | null }> {
  return exclusive(async () => {
    try {
      const session = await activitiesRepository.getActiveSession()
      const store = useRecordingStore.getState()
      if (!session) {
        if (store.session) store.reset()
        await stopStreamTolerant()
        return { action: 'none', sessionId: null }
      }
      if (store.session) return { action: 'held', sessionId: session.id }
      return { action: await resumeAfterProcessDeath(session), sessionId: session.id }
    } finally {
      useRecordingStore.getState().markResumeSettled()
    }
  })
}

export function finishRecording(sessionId: number, input: NewActivityInput): Promise<number> {
  return exclusive(async () => {
    await stopStreamTolerant()
    useRecordingStore.getState().setStreamState({ stream: { kind: 'stopped' } })
    const activityId = await useActivitiesStore.getState().saveActivity(sessionId, input)
    logEvent('info', 'recording', 'finished', { sessionId })
    useRecordingStore.getState().reset()
    return activityId
  })
}
