import { useMapCapabilities, type StyleDescriptor } from './provider'
import { useMapStore } from '../store/mapStore'

// The layer the map shows: the chosen one, or the provider's first when the choice is unknown to it.
export function useCurrentMapStyle(): StyleDescriptor {
  const caps = useMapCapabilities()
  const styleId = useMapStore((s) => s.mapStyleId)
  return caps.styles.find((s) => s.id === styleId) ?? caps.styles[0]
}
