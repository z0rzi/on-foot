import { OVERVIEW_LINE_SLOTS } from '../../provider/stacking'
import { PIN_LAYERS, overviewLineLayerId } from './overviewLayers'

// The layers a press is looked for in: every overview line layer, and of a pin the teardrop's widest
// shape, its tag and the cluster's disc. The query names them, so nothing of the style's own comes
// back.
export const OVERVIEW_PRESS_LAYERS: readonly string[] = [
  ...OVERVIEW_LINE_SLOTS.map(overviewLineLayerId),
  PIN_LAYERS.outline,
  PIN_LAYERS.tag,
  PIN_LAYERS.cluster,
]

// The square around the press, `tolerance` dp each way, as the query takes it: [top, left, bottom,
// right] in dp, on Android as on iOS.
export function pressBox(x: number, y: number, tolerance: number): [number, number, number, number] {
  return [y - tolerance, x - tolerance, y + tolerance, x + tolerance]
}

interface PressHits {
  pins: string[]
  lines: string[]
  // Each cluster's feature, which its leaves are read by.
  clusters: GeoJSON.Feature[]
}

const keyOf = (feature: GeoJSON.Feature): string | null => {
  const key: unknown = feature.properties?.key
  return typeof key === 'string' ? key : null
}

// The hits sorted by what they are: a cluster by its count, a pin by its point, a line by any other
// geometry. A line comes back once per map tile it crosses and a teardrop and its tag are two hits,
// so each key, and each cluster, is reported once.
export function sortHits(features: readonly GeoJSON.Feature[]): PressHits {
  const pins = new Set<string>()
  const lines = new Set<string>()
  const clusters = new Map<unknown, GeoJSON.Feature>()
  for (const feature of features) {
    if (feature.properties?.point_count != null) {
      clusters.set(feature.properties.cluster_id, clusters.get(feature.properties.cluster_id) ?? feature)
      continue
    }
    const key = keyOf(feature)
    if (key == null) continue
    if (feature.geometry.type === 'Point') pins.add(key)
    else lines.add(key)
  }
  return { pins: [...pins], lines: [...lines], clusters: [...clusters.values()] }
}

export function leafKeys(leaves: GeoJSON.FeatureCollection): string[] {
  return leaves.features.map(keyOf).filter((key): key is string => key != null)
}
