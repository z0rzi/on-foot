import type { StyleDescriptor } from '../../provider/types'

export const MAPBOX_STYLES: StyleDescriptor[] = [
  { id: 'standard',  label: 'Default',   url: 'mapbox://styles/mapbox/standard',           preview: require('../../../assets/layers/default.png') },
  { id: 'satellite', label: 'Satellite', url: 'mapbox://styles/mapbox/standard-satellite', preview: require('../../../assets/layers/satellite.png'), satellite: true },
  { id: 'outdoors',  label: 'Outdoors',  url: 'mapbox://styles/mapbox/outdoors-v12',       preview: require('../../../assets/layers/outdoors.png') },
]

// tileSize is a Mapbox DEM implementation detail (not exposed on the port); terrain
// exaggeration flows through TerrainProps and lives in the agnostic MapTokens instead.
export const TERRAIN_DEM = {
  url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
  tileSize: 514,
} as const
