import { create } from 'zustand'
import { activitiesRepository, LiveTrackPoint, RecordingSession, TrackPoint } from '../data/activities'
import { errorClass, logEvent } from '../log'
import type { InterruptionGap } from './interruption'
import { historyActivityIds, historyFactor } from './personalFactor'
import { recordingPhase, type RecordingPhase } from './recordingPhase'

export type CaptureFault = 'start-failed' | 'permission-missing'

export type StreamStatus =
  // No start is known to be live.
  | { kind: 'stopped' }
  // A start resolved with a provider available before and after it, so its request is live.
  | { kind: 'live' }
  // Capture is known not to be running while the session records, and why.
  | { kind: 'faulted'; fault: CaptureFault }

// What this process has observed about capture. None of it survives a restart: a new process must
// observe again before it can claim anything. A live request survives location being switched off
// and back on — the same request is registered before and after — so locationAvailable is a fact
// distinct from the stream, not folded into it.
interface StreamState {
  // Whether a location provider was available when last checked; null until checked.
  locationAvailable: boolean | null
  stream: StreamStatus
}

interface RecordingStore extends StreamState {
  // In-memory reflection of the durable recording_sessions row; set from it on every transition.
  session: RecordingSession | null
  // Flat, segment-tagged points mirroring the recording_points rows. Segments are the distinct
  // `segment` values; consumers group on demand (groupPointsBySegment) for rendering and metrics.
  livePoints: LiveTrackPoint[]
  // Launch handling has decided what the durable session means for this process.
  resumeSettled: boolean
  // A gap left by a dead process, waiting to be announced once the map is on screen.
  interruption: InterruptionGap | null
  // The personal factor of the walker's recent hikes, read from the saved activities whenever the
  // store takes a session it did not hold or the session's next segment begins (a start, a resume, a
  // relaunch). 1 until that read resolves, and after a failed one.
  historyFactor: number
  beginSession: (session: RecordingSession) => void
  hydrate: (session: RecordingSession, points: LiveTrackPoint[]) => void
  setSession: (session: RecordingSession) => void
  appendLivePoints: (segment: number, points: TrackPoint[]) => void
  setStreamState: (state: Partial<StreamState>) => void
  markResumeSettled: () => void
  announceInterruption: (gap: InterruptionGap) => void
  clearInterruption: () => void
  reset: () => void
}

const CLEARED_STREAM: StreamState = { locationAvailable: null, stream: { kind: 'stopped' } }

export const useRecordingStore = create<RecordingStore>((set, get) => {
  // A read that resolves once its recording has ended is dropped.
  const loadHistoryFactor = async () => {
    const sessionId = get().session?.id
    let factor = 1
    try {
      factor = await historyFactorOfSavedActivities()
    } catch (error) {
      logEvent('warn', 'recording', 'personal factor history read failed', { errorClass: errorClass(error) })
    }
    if (get().session?.id === sessionId) set({ historyFactor: factor })
  }
  // Every transition that sets the session goes through here, so no path that begins a segment
  // misses the history read.
  const takeSession = (session: RecordingSession, state: Partial<RecordingStore> = {}) => {
    const held = get().session
    set({ ...state, session })
    if (held?.id !== session.id || held.currentSegment !== session.currentSegment) void loadHistoryFactor()
  }
  return {
    session: null,
    livePoints: [],
    ...CLEARED_STREAM,
    resumeSettled: false,
    interruption: null,
    historyFactor: 1,
    beginSession: (session) => takeSession(session, { livePoints: [], historyFactor: 1, ...CLEARED_STREAM }),
    hydrate: (session, points) => takeSession(session, { livePoints: points, ...CLEARED_STREAM }),
    setSession: (session) => takeSession(session),
    appendLivePoints: (segment, points) =>
      set((s) =>
        points.length === 0
          ? {}
          : { livePoints: [...s.livePoints, ...points.map((p) => ({ ...p, segment }))] },
      ),
    setStreamState: (state) => set(state),
    markResumeSettled: () => set({ resumeSettled: true }),
    announceInterruption: (gap) => set({ interruption: gap }),
    clearInterruption: () => set({ interruption: null }),
    reset: () => set({ session: null, livePoints: [], interruption: null, historyFactor: 1, ...CLEARED_STREAM }),
  }
})

async function historyFactorOfSavedActivities(): Promise<number> {
  const ids = historyActivityIds(await activitiesRepository.listOverviewRows())
  const activities = await Promise.all(ids.map((id) => activitiesRepository.getActivity(id)))
  return historyFactor(activities.flatMap((a) => (a ? [a.geometry.segments] : [])))
}

export function currentRecordingPhase(): RecordingPhase {
  return recordingPhase(useRecordingStore.getState().session)
}
