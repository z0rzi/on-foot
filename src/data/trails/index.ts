import { sqliteTrailsRepository } from '../db/trailsRepository'
import { TrailsRepository } from './repository'

export const trailsRepository: TrailsRepository = sqliteTrailsRepository

export * from './types'
export * from './repository'

