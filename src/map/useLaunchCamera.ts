import { useEffect, useSyncExternalStore } from 'react'
import { logEvent } from '../log'
import { useMapStore } from '../store/mapStore'
import { useMapCapabilities } from './provider'
import { launchCamera } from './launchCamera'
import type { CameraFraming } from './provider/types'

// Decides once per session, from the hydrated map store, what the camera does at launch, and
// returns the camera the map starts on when the launch restores one.
export function useLaunchCamera(): CameraFraming | undefined {
  const { minZoom, maxZoom } = useMapCapabilities()
  const hydrated = useSyncExternalStore(useMapStore.persist.onFinishHydration, useMapStore.persist.hasHydrated)
  const launchResolved = useMapStore((s) => s.launchResolved)
  const restoredCamera = useMapStore((s) => s.restoredCamera)

  useEffect(() => {
    if (!hydrated || launchResolved) return
    const { followMode, lastCamera, restoreCamera, startFollow } = useMapStore.getState()
    const launch = launchCamera(followMode, lastCamera, { minZoom, maxZoom })
    if (launch.kind === 'restore') {
      restoreCamera(launch.camera)
      return
    }
    if (launch.invalid) logEvent('warn', 'map', 'last camera not restored', { reason: launch.invalid })
    startFollow(launch.mode)
  }, [hydrated, launchResolved, minZoom, maxZoom])

  return restoredCamera ?? undefined
}
