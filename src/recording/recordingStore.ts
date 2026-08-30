import { create } from 'zustand'
import { ActivityGeometry, RecordingSession, TrackPoint } from '../data/activities/types'

export type RecordingPhase = 'idle' | 'recording' | 'paused'

// Phase is derived from the durable session — the single source of truth — so the UI can never
// disagree with what is persisted: no session is idle, a session with a pausedAt is paused, an
// otherwise-open session is recording.
export function recordingPhase(session: RecordingSession | null): RecordingPhase {
  if (!session) return 'idle'
  return session.pausedAt != null ? 'paused' : 'recording'
}

const EMPTY_GEOMETRY: ActivityGeometry = { points: [] }

interface RecordingStore {
  // In-memory reflection of the durable recording_sessions row; set from it on every transition.
  session: RecordingSession | null
  liveGeometry: ActivityGeometry
  beginSession: (session: RecordingSession) => void
  hydrate: (session: RecordingSession, points: TrackPoint[]) => void
  setSession: (session: RecordingSession) => void
  appendLivePoints: (points: TrackPoint[]) => void
  reset: () => void
}

export const useRecordingStore = create<RecordingStore>((set) => ({
  session: null,
  liveGeometry: EMPTY_GEOMETRY,
  beginSession: (session) => set({ session, liveGeometry: EMPTY_GEOMETRY }),
  hydrate: (session, points) => set({ session, liveGeometry: { points } }),
  setSession: (session) => set({ session }),
  appendLivePoints: (points) =>
    set((s) => (points.length === 0 ? {} : { liveGeometry: { points: [...s.liveGeometry.points, ...points] } })),
  reset: () => set({ session: null, liveGeometry: EMPTY_GEOMETRY }),
}))
