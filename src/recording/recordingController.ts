import { activitiesRepository, NewActivityInput, RecordingSession } from '../data/activities'
import {
  hasForegroundAccess,
  isLocationAvailable,
  promptToEnableLocation,
  requestBackgroundAccess,
  requestForegroundAccess,
  startBackgroundTracking,
  stopBackgroundTracking,
} from '../location'
import { formatClockTime } from '../activities/format'
import { showToast } from '../components/toast'
import { useActivitiesStore } from '../store/activitiesStore'
import { isAppActive, whenAppActive } from './appActivity'
import { ensureTrackingNotificationAccess } from './notificationAccess'
import { RECORDING_OPTIONS } from './options'
import { useRecordingStore } from './recordingStore'
import { resumeActionFor, ResumeAction } from './resume'
import { applyPause, applyRelaunch, applyResume } from './session'

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
      stream: isAppActive() ? { kind: 'faulted', fault: 'start-failed' } : { kind: 'stopped' },
    })
    return
  }
  const available = await isLocationAvailable()
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

// Prompts run before the turn is queued: a dialog that never answers must not hold pause, resume or
// discard behind it.
export async function startRecording(): Promise<StartResult> {
  if (await activitiesRepository.getActiveSession()) return 'already-active'
  if (!(await requestForegroundAccess())) return 'permission-denied'
  // A launched recording must go on capturing once the app leaves the foreground, so starting asks
  // for "All the time" access; recovery only ever restarts a stream while the app is active, so it
  // needs no more than the foreground grant checked in ensureStreaming.
  if (!(await requestBackgroundAccess())) return 'permission-denied'
  if (!(await isLocationAvailable()) && !(await promptToEnableLocation())) return 'location-off'
  await ensureTrackingNotificationAccess()
  await whenAppActive()
  return exclusive<StartResult>(async () => {
    // A session found here belongs to a concurrent tap that reached the turn first: the tap that
    // lost reports the start it asked for, not a pre-existing recording.
    if (await activitiesRepository.getActiveSession()) return 'started'
    const startedAt = Date.now()
    const sessionId = await activitiesRepository.startSession(startedAt)
    useRecordingStore.getState().beginSession({
      id: sessionId, startedAt, linkedTrailId: null, pausedAt: null, pausedMs: 0, currentSegment: 0, segmentStartedAt: startedAt,
    })
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
    store.setStreamState({ stream: { kind: 'stopped' } })
    // The pause is already durable and the background task drops fixes whenever pausedAt is set, so
    // failing to stop the stream costs battery, not correctness — it must not fail the pause.
    try {
      await stopBackgroundTracking()
    } catch {
      // Left running; discard or finish stops it, and a later resume replaces it.
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
    await activitiesRepository.markResumed(session.id, next.pausedMs, next.currentSegment, next.segmentStartedAt)
    useRecordingStore.getState().setSession(next)
    await issueStreamIfAvailable()
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
      useRecordingStore.getState().setStreamState({ stream: { kind: 'faulted', fault: 'permission-missing' } })
      return
    }
    const stream = useRecordingStore.getState().stream
    if (stream.kind === 'faulted' && stream.fault === 'permission-missing') {
      useRecordingStore.getState().setStreamState({ stream: { kind: 'stopped' } })
    }
    if (!(await refreshAvailability()) || useRecordingStore.getState().stream.kind === 'live') return
    await issueStream()
  })
}

// A recording row with an empty store means the JavaScript runtime died while recording: swiping the
// app away only remounts the React root, and the store — module state — survives that. The gap gets
// its own segment and the user is told; capture restarts, which also restores the foreground service
// a restored task never gets.
async function resumeAfterProcessDeath(session: RecordingSession): Promise<void> {
  const points = await activitiesRepository.getSessionPoints(session.id)
  const relaunched = applyRelaunch(session, Date.now())
  await activitiesRepository.markResumed(relaunched.id, relaunched.pausedMs, relaunched.currentSegment, relaunched.segmentStartedAt)
  useRecordingStore.getState().hydrate(relaunched, points)
  const since = points.length > 0 ? points[points.length - 1].t : session.startedAt
  showToast(`Recording interrupted ${formatClockTime(since)}–${formatClockTime(Date.now())}`)
  await issueStreamIfAvailable()
}

export function resumeIfActive(): Promise<{ action: ResumeAction; sessionId: number | null }> {
  return exclusive(async () => {
    try {
      const session = await activitiesRepository.getActiveSession()
      const action = resumeActionFor(session)
      const store = useRecordingStore.getState()
      if (!session) {
        if (store.session) store.reset()
        try {
          await stopBackgroundTracking()
        } catch {
          // A stream that cannot be stopped now is stopped by the next launch.
        }
      } else if (!store.session) {
        if (action === 'resume') await resumeAfterProcessDeath(session)
        else store.hydrate(session, await activitiesRepository.getSessionPoints(session.id))
      }
      return { action, sessionId: session?.id ?? null }
    } finally {
      useRecordingStore.getState().markResumeSettled()
    }
  })
}

// The saved activity matters more than a lingering service, so a stop failure does not block the
// save; the next launch stops an orphaned stream.
export function finishRecording(sessionId: number, input: NewActivityInput): Promise<number> {
  return exclusive(async () => {
    try {
      await stopBackgroundTracking()
    } catch {
      // Stopped by the next launch.
    }
    useRecordingStore.getState().setStreamState({ stream: { kind: 'stopped' } })
    const activityId = await useActivitiesStore.getState().saveActivity(sessionId, input)
    useRecordingStore.getState().reset()
    return activityId
  })
}
