import { sqliteActivitiesRepository } from '../db/activitiesRepository'
import { ActivitiesRepository } from './repository'

export const activitiesRepository: ActivitiesRepository = sqliteActivitiesRepository

export * from './types'
export * from './repository'
