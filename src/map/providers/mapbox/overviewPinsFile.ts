import type { OverviewPin } from '../../provider/types'

// The pins as the text of a GeoJSON FeatureCollection of points, one per pin, for the one clustered
// source: a pin not in the file is in no cluster (D117, D138).
export function pinsFile(pins: readonly OverviewPin[]): string {
  return JSON.stringify({
    type: 'FeatureCollection',
    features: pins.map(({ position, ...properties }) => ({
      type: 'Feature',
      properties,
      geometry: { type: 'Point', coordinates: position },
    })),
  })
}
