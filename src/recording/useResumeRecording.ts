import { useEffect, useRef } from 'react'
import { useRootNavigationState } from 'expo-router'
import { resumeIfActive } from './recordingController'
import { logEvent } from '../log'
import { deviceInfo } from '../log/deviceInfo'

export function useResumeRecording() {
  const navState = useRootNavigationState()
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current || !navState?.key) return
    handled.current = true
    logEvent('info', 'launch', 'cold start', { appVersion: deviceInfo().appVersion })
    resumeIfActive()
      .then(({ action, sessionId }) => {
        logEvent('info', 'launch', `launch action ${action}`, { sessionId })
      })
      .catch((error: unknown) => {
        logEvent('error', 'launch', 'resume on launch failed', { error: String(error) })
        // A resume failure (e.g. permission revoked while the app was dead) leaves the map as a
        // normal launch; the durable session persists, so the next launch retries.
      })
  }, [navState?.key])
}
