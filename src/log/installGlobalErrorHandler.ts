import type { ErrorUtils } from 'react-native'
import { logEvent } from './logEvent'

// React Native exposes ErrorUtils as a global value but exports only its type, so the global is read
// through that interface rather than left as any; the previous handler still runs, so the red screen
// and the native crash report are unchanged.
const globalErrorUtils = (globalThis as unknown as { ErrorUtils?: ErrorUtils }).ErrorUtils

export function installGlobalErrorHandler(): void {
  if (!globalErrorUtils) return
  const previous = globalErrorUtils.getGlobalHandler()
  globalErrorUtils.setGlobalHandler((error, isFatal) => {
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    logEvent('error', 'error', isFatal ? 'uncaught fatal error' : 'uncaught error', { message, stack })
    previous(error, isFatal)
  })
}
