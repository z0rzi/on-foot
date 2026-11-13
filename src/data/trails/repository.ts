import { OverviewFill } from '../geo/overview'
import { NewTrailInput, Trail, TrailOverviewRow, TrailUpdate } from './types'

export interface TrailsRepository {
  listOverviewRows(): Promise<TrailOverviewRow[]>
  getTrail(id: number): Promise<Trail | null>
  createTrail(input: NewTrailInput): Promise<number>
  updateTrail(id: number, update: TrailUpdate): Promise<void>
  deleteTrail(id: number): Promise<void>
  // The rows saved before overviews existed, for the backfill.
  listIdsWithoutOverview(): Promise<number[]>
  fillOverview(id: number): Promise<OverviewFill>
}
