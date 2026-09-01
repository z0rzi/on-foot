import { create } from 'zustand'
import { LiveTrackPoint, RecordingSession, TrackPoint } from '../data/activities/types'

export type RecordingPhase = 'idle' | 'recording' | 'paused'

// Phase is derived from the durable session — the single source of truth — so the UI can never
// disagree with what is persisted: no session is idle, a session with a pausedAt is paused, an
// otherwise-open session is recording.
export function recordingPhase(session: RecordingSession | null): RecordingPhase {
  if (!session) return 'idle'
  return session.pausedAt != null ? 'paused' : 'recording'
}

interface RecordingStore {
  // In-memory reflection of the durable recording_sessions row; set from it on every transition.
  session: RecordingSession | null
  // Flat, segment-tagged points mirroring the recording_points rows. Segments are the distinct
  // `segment` values; consumers group on demand (groupPointsBySegment) for rendering and metrics.
  livePoints: LiveTrackPoint[]
  beginSession: (session: RecordingSession) => void
  hydrate: (session: RecordingSession, points: LiveTrackPoint[]) => void
  setSession: (session: RecordingSession) => void
  appendLivePoints: (segment: number, points: TrackPoint[]) => void
  reset: () => void
}

export const useRecordingStore = create<RecordingStore>((set) => ({
  session: null,
  livePoints: [],
  beginSession: (session) => set({ session, livePoints: [] }),
  hydrate: (session, points) => set({ session, livePoints: points }),
  setSession: (session) => set({ session }),
  appendLivePoints: (segment, points) =>
    set((s) =>
      points.length === 0
        ? {}
        : { livePoints: [...s.livePoints, ...points.map((p) => ({ ...p, segment }))] },
    ),
  reset: () => set({ session: null, livePoints: [] }),
}))
