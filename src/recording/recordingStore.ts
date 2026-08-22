import { create } from 'zustand'
import { ActivityGeometry, RecordingSession, TrackPoint } from '../data/activities'

export type RecordingPhase = 'idle' | 'recording' | 'saving'

const EMPTY_GEOMETRY: ActivityGeometry = { points: [] }

interface RecordingStore {
  phase: RecordingPhase
  sessionId: number | null
  startedAt: number | null
  liveGeometry: ActivityGeometry
  startRecording: (sessionId: number, startedAt: number) => void
  hydrateFrom: (session: RecordingSession, points: TrackPoint[]) => void
  appendLivePoints: (points: TrackPoint[]) => void
  beginSaving: () => void
  reset: () => void
}

export const useRecordingStore = create<RecordingStore>((set) => ({
  phase: 'idle',
  sessionId: null,
  startedAt: null,
  liveGeometry: EMPTY_GEOMETRY,
  startRecording: (sessionId, startedAt) =>
    set({ phase: 'recording', sessionId, startedAt, liveGeometry: EMPTY_GEOMETRY }),
  hydrateFrom: (session, points) =>
    set({ phase: 'recording', sessionId: session.id, startedAt: session.startedAt, liveGeometry: { points } }),
  appendLivePoints: (points) =>
    set((s) => (points.length === 0 ? {} : { liveGeometry: { points: [...s.liveGeometry.points, ...points] } })),
  beginSaving: () => set({ phase: 'saving' }),
  reset: () => set({ phase: 'idle', sessionId: null, startedAt: null, liveGeometry: EMPTY_GEOMETRY }),
}))
