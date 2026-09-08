import { useEffect, useRef } from 'react'
import { useRootNavigationState } from 'expo-router'
import { resumeIfActive } from './recordingController'

export function useResumeRecording() {
  const navState = useRootNavigationState()
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current || !navState?.key) return
    handled.current = true
    resumeIfActive().catch(() => {
      // A resume failure (e.g. permission revoked while the app was dead) leaves the map as a
      // normal launch; the durable session persists, so the next launch retries.
    })
  }, [navState?.key])
}
