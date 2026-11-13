import type { OverviewItem } from '../../provider/types'

// The overview's lines as the text of a GeoJSON FeatureCollection, joined around each item's stored
// geometry text: no geometry is parsed or serialised again (D138).
export function linesFile(items: readonly OverviewItem[]): string {
  const features = items.map(
    (item) =>
      `{"type":"Feature","properties":${JSON.stringify({ key: item.key, class: item.class })},"geometry":${item.geometry}}`,
  )
  return `{"type":"FeatureCollection","features":[${features.join(',')}]}`
}

// A position in the geometry text is a bracket opening on a number.
const POSITION = /\[-?\d/g

export function linesFileCounts(items: readonly OverviewItem[]): { trails: number; activities: number; points: number } {
  let trails = 0
  let points = 0
  for (const item of items) {
    if (item.class === 'trail') trails++
    points += item.geometry.match(POSITION)?.length ?? 0
  }
  return { trails, activities: items.length - trails, points }
}
