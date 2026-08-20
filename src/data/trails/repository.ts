import { NewTrailInput, Trail, TrailSummary } from './types'

export interface TrailsRepository {
  listSummaries(): Promise<TrailSummary[]>
  getTrail(id: number): Promise<Trail | null>
  createTrail(input: NewTrailInput): Promise<number>
  deleteTrail(id: number): Promise<void>
}
