import { sqliteTrailsRepository } from '../db/trailsRepository'
import { TrailsRepository } from './repository'

export const trailsRepository: TrailsRepository = sqliteTrailsRepository

export * from './types'
export * from './repository'

// Module-level so it is a stable dependency for useLoadedEntity's effect.
export const loadTrail = (id: number) => trailsRepository.getTrail(id)
