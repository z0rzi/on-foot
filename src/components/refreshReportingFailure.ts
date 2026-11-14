import { errorClass, logEvent } from '../log'
import { showToast } from './toast'

export type RefreshFailure = { logMessage: string; toast: string }

// A failed refresh leaves the list on its last known rows, and the toast says they may be stale.
export async function refreshReportingFailure(
  load: () => Promise<unknown>,
  failure: RefreshFailure,
): Promise<void> {
  try {
    await load()
  } catch (error) {
    logEvent('error', 'error', failure.logMessage, { errorClass: errorClass(error) })
    showToast(failure.toast)
  }
}
