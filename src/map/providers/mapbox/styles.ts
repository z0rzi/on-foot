import type { StyleDescriptor } from '../../provider/types'

// The three layers' labels use DIN Pro, with Arial Unicode MS for every other script and for `✓`.
const DIN_PRO = ['DIN Pro Medium', 'Arial Unicode MS Regular']

export const MAPBOX_STYLES: StyleDescriptor[] = [
  { id: 'standard',  label: 'Default',   url: 'mapbox://styles/mapbox/standard',           preview: require('../../../assets/layers/default.png'), tone: 'light', labelFont: DIN_PRO },
  { id: 'satellite', label: 'Satellite', url: 'mapbox://styles/mapbox/standard-satellite', preview: require('../../../assets/layers/satellite.png'), satellite: true, tone: 'dark', labelFont: DIN_PRO },
  { id: 'outdoors',  label: 'Outdoors',  url: 'mapbox://styles/mapbox/outdoors-v12',       preview: require('../../../assets/layers/outdoors.png'), tone: 'light', labelFont: DIN_PRO },
]

// tileSize is a Mapbox DEM implementation detail (not exposed on the port); terrain
// exaggeration flows through TerrainProps and lives in the agnostic MapTokens instead.
export const TERRAIN_DEM = {
  url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
  tileSize: 514,
} as const
