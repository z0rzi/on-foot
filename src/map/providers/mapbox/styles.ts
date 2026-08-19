import type { StyleDescriptor } from '../../provider/types'

export const MAPBOX_STYLES: StyleDescriptor[] = [
  { id: 'standard',  label: 'Default',   url: 'mapbox://styles/mapbox/standard',           preview: require('../../../assets/layers/default.png') },
  { id: 'satellite', label: 'Satellite', url: 'mapbox://styles/mapbox/standard-satellite', preview: require('../../../assets/layers/satellite.png') },
  { id: 'outdoors',  label: 'Outdoors',  url: 'mapbox://styles/mapbox/outdoors-v12',       preview: require('../../../assets/layers/outdoors.png') },
]

export const TERRAIN_DEM = {
  url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
  tileSize: 514,
  exaggeration: 1.0,
} as const
