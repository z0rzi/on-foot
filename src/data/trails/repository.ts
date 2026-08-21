import { NewTrailInput, Trail, TrailSummary, TrailUpdate } from './types'

export interface TrailsRepository {
  listSummaries(): Promise<TrailSummary[]>
  getTrail(id: number): Promise<Trail | null>
  createTrail(input: NewTrailInput): Promise<number>
  updateTrail(id: number, update: TrailUpdate): Promise<void>
  deleteTrail(id: number): Promise<void>
}
