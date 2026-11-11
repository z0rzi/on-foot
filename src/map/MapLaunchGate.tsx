import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { logEvent } from '../log'
import { useMapStore } from '../store/mapStore'
import { MapTokens } from '../theme/tokens'
import { useMapCapabilities } from './provider'
import { launchCamera, launchCameraDetail, type LaunchCamera } from './launchCamera'
import { hydrationGate } from './hydrationGate'

// Renders its children only once this session's launch camera is decided, so the map mounts with
// the camera it starts on instead of the provider's whole-earth default. The decision waits on the
// map store's hydration, bounded so a storage that fails or never answers cannot hold the app:
// then the launch follows on the defaults. Decided once per session and held.
export function MapLaunchGate({ children }: { children: ReactNode }) {
  const { minZoom, maxZoom } = useMapCapabilities()
  const hydrated = useSyncExternalStore(useMapStore.persist.onFinishHydration, useMapStore.persist.hasHydrated)
  const hydrationError = useMapStore((s) => s.hydrationError)
  const launchResolved = useMapStore((s) => s.launchResolved)
  const [timedOut, setTimedOut] = useState(false)
  const gate = hydrationGate({ hydrated, failed: hydrationError != null, timedOut })

  useEffect(() => {
    if (launchResolved) return
    const id = setTimeout(() => setTimedOut(true), MapTokens.hydrationBoundMs)
    return () => clearTimeout(id)
  }, [launchResolved])

  useEffect(() => {
    if (gate === 'wait' || launchResolved) return
    const { followMode, lastCamera, restoreCamera, startFollow } = useMapStore.getState()
    let launch: LaunchCamera
    if (gate === 'hydrated') {
      launch = launchCamera(followMode, lastCamera, { minZoom, maxZoom })
      if (launch.kind === 'follow' && launch.invalid) {
        logEvent('warn', 'map', 'persisted launch camera ignored', { reason: launch.invalid })
      }
    } else {
      if (gate === 'failed') {
        logEvent('warn', 'map', 'map store hydration failed, launch follows', { errorClass: hydrationError })
      } else {
        logEvent('warn', 'map', 'map store hydration timed out, launch follows', { boundMs: MapTokens.hydrationBoundMs })
      }
      launch = { kind: 'follow', mode: 'position' }
    }
    logEvent('info', 'map', 'launch camera', launchCameraDetail(launch))
    if (launch.kind === 'restore') restoreCamera(launch.camera)
    else startFollow(launch.mode, launch.from)
  }, [gate, launchResolved, hydrationError, minZoom, maxZoom])

  return launchResolved ? children : null
}
