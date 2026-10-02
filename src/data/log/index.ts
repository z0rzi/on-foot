import { sqliteLogRepository } from '../db/logRepository'
import { LogRepository } from './repository'

export const logRepository: LogRepository = sqliteLogRepository

export * from './types'
export * from './repository'
