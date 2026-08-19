import type { MapCapabilities } from '../../provider/types'
import { MAPBOX_STYLES } from './styles'
export { MAPBOX_STYLES }

export const mapboxCapabilities: MapCapabilities = {
  id: 'mapbox',
  requiresToken: true,
  supportsTerrain: true,
  supportsDataDrivenLayers: true,
  offline: true,
  styles: MAPBOX_STYLES,
}
