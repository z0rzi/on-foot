import type { MapCapabilities } from '../../provider/types'
import { MAPBOX_STYLES } from './styles'
export { MAPBOX_STYLES }

export const mapboxCapabilities: MapCapabilities = {
  id: 'mapbox',
  supportsTerrain: true,
  styles: MAPBOX_STYLES,
}
