import { useEffect, useRef } from 'react'
import { useRootNavigationState, useRouter } from 'expo-router'
import { resumeIfActive } from './recordingController'

export function useResumeRecording() {
  const router = useRouter()
  const navState = useRootNavigationState()
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current || !navState?.key) return
    handled.current = true
    resumeIfActive()
      .then(() => {
        // Resume/paused sessions are hydrated by resumeIfActive; the map renders their controls.
        // A killed-while-paused session lands on the paused map, from which Stop reaches the save form.
      })
      .catch(() => {
        // A resume failure (e.g. permission revoked while the app was dead) leaves the map as a
        // normal launch; the durable session persists, so the next launch retries.
      })
  }, [navState?.key, router])
}
