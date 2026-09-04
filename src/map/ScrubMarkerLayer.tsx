import { useMapProvider } from './provider'
import { useTheme } from '../theme/useTheme'
import { MapTokens } from '../theme/tokens'
import { useScrubStore } from '../elevation/scrubStore'

export function ScrubMarkerLayer() {
  const point = useScrubStore((s) => s.point)
  const { components } = useMapProvider()
  const c = useTheme()
  if (!point) return null
  const { ScrubMarker } = components
  return (
    <ScrubMarker
      coordinate={[point.lng, point.lat]}
      color={c.controlAccent}
      radius={MapTokens.endpointRadius}
      strokeColor={c.trailEndpointStroke}
      strokeWidth={MapTokens.endpointStrokeWidth}
    />
  )
}
