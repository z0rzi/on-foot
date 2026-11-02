import { useCallback, useEffect, useRef } from 'react'
import { useMapStore } from '../store/mapStore'
import { MapTokens } from '../theme/tokens'
import type { CameraFraming } from './provider/types'

// A camera-changed handler that records the framing as the last camera once the camera has stayed
// still for MapTokens.cameraRestMs, so the store is written when the camera comes to rest, not on
// every frame of a gesture or animation.
export function useLastCameraCapture(): (framing: CameraFraming) => void {
  const setLastCamera = useMapStore((s) => s.setLastCamera)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  return useCallback(
    (framing: CameraFraming) => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setLastCamera(framing), MapTokens.cameraRestMs)
    },
    [setLastCamera],
  )
}
