import { create } from 'zustand'
import { LiveTrackPoint, RecordingSession, TrackPoint } from '../data/activities/types'

export type RecordingPhase = 'idle' | 'recording' | 'paused'

export type CaptureFault = 'start-failed' | 'permission-missing'

// Phase is derived from the durable session — the single source of truth — so the UI can never
// disagree with what is persisted: no session is idle, a session with a pausedAt is paused, an
// otherwise-open session is recording.
export function recordingPhase(session: RecordingSession | null): RecordingPhase {
  if (!session) return 'idle'
  return session.pausedAt != null ? 'paused' : 'recording'
}

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
  beginSession: (session: RecordingSession) => void
  hydrate: (session: RecordingSession, points: LiveTrackPoint[]) => void
  setSession: (session: RecordingSession) => void
  appendLivePoints: (segment: number, points: TrackPoint[]) => void
  setStreamState: (state: Partial<StreamState>) => void
  markResumeSettled: () => void
  reset: () => void
}

const CLEARED_STREAM: StreamState = { locationAvailable: null, stream: { kind: 'stopped' } }

export const useRecordingStore = create<RecordingStore>((set) => ({
  session: null,
  livePoints: [],
  ...CLEARED_STREAM,
  resumeSettled: false,
  beginSession: (session) => set({ session, livePoints: [], ...CLEARED_STREAM }),
  hydrate: (session, points) => set({ session, livePoints: points, ...CLEARED_STREAM }),
  setSession: (session) => set({ session }),
  appendLivePoints: (segment, points) =>
    set((s) =>
      points.length === 0
        ? {}
        : { livePoints: [...s.livePoints, ...points.map((p) => ({ ...p, segment }))] },
    ),
  setStreamState: (state) => set(state),
  markResumeSettled: () => set({ resumeSettled: true }),
  reset: () => set({ session: null, livePoints: [], ...CLEARED_STREAM }),
}))
