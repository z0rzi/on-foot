import { useCallback } from 'react'
import { useFocusEffect } from 'expo-router'
import { RefreshFailure, refreshReportingFailure } from './refreshReportingFailure'

// `load` must be stable (a store action, or a useCallback): a fresh function each render would
// re-run the refresh on every render while focused.
export function useRefreshOnFocus(load: () => Promise<unknown>, failure: RefreshFailure): void {
  const { logMessage, toast } = failure
  useFocusEffect(
    useCallback(() => {
      void refreshReportingFailure(load, { logMessage, toast })
    }, [load, logMessage, toast]),
  )
}
