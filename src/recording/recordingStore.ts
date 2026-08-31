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

const EMPTY_GEOMETRY: ActivityGeometry = { segments: [] }

interface RecordingStore {
  // In-memory reflection of the durable recording_sessions row; set from it on every transition.
  session: RecordingSession | null
  liveGeometry: ActivityGeometry
  beginSession: (session: RecordingSession) => void
  hydrate: (session: RecordingSession, segments: TrackPoint[][]) => void
  setSession: (session: RecordingSession) => void
  appendLivePoints: (points: TrackPoint[]) => void
  startSegment: () => void
  reset: () => void
}

export const useRecordingStore = create<RecordingStore>((set) => ({
  session: null,
  liveGeometry: EMPTY_GEOMETRY,
  beginSession: (session) => set({ session, liveGeometry: { segments: [[]] } }),
  hydrate: (session, segments) => set({ session, liveGeometry: { segments } }),
  setSession: (session) => set({ session }),
  appendLivePoints: (points) =>
    set((s) => {
      if (points.length === 0) return {}
      const segments = s.liveGeometry.segments
      const last = segments.length > 0 ? segments[segments.length - 1] : []
      const head = segments.length > 0 ? segments.slice(0, -1) : []
      return { liveGeometry: { segments: [...head, [...last, ...points]] } }
    }),
  startSegment: () => set((s) => ({ liveGeometry: { segments: [...s.liveGeometry.segments, []] } })),
  reset: () => set({ session: null, liveGeometry: EMPTY_GEOMETRY }),
}))
