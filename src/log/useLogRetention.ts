import { useEffect } from 'react'
import { logRepository } from '../data/log'
import { LOG_MAX_ENTRIES, retentionCutoff } from './retention'

export function useLogRetention(): void {
  useEffect(() => {
    logRepository.trim(retentionCutoff(Date.now()), LOG_MAX_ENTRIES).catch(() => {})
  }, [])
}
