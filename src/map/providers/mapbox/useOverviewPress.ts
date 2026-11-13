import { useCallback, type RefObject } from 'react'
import type Mapbox from '@rnmapbox/maps'
import type { OverviewClusterHit, OverviewPress } from '../../provider/types'
import { useMapPress, type MapPressFeature } from './mapPress'
import { OVERVIEW_PRESS_LAYERS, leafKeys, pressBox, sortHits } from './overviewPress'
import { errorClass, logEvent } from '../../../log'

// A cluster's keys and the zoom it splits at, read from the pins source it came from, the one
// clustered source. Past the source's cluster cap the engine reports the cap plus one.
async function clusterHit(source: Mapbox.ShapeSource, cluster: GeoJSON.Feature): Promise<OverviewClusterHit> {
  const [leaves, splitZoom] = await Promise.all([
    source.getClusterLeaves(cluster, Number(cluster.properties?.point_count), 0) as Promise<GeoJSON.FeatureCollection>,
    source.getClusterExpansionZoom(cluster),
  ])
  return { keys: leafKeys(leaves), splitZoom }
}

// What of the overview lies under the press: one rendered-features query in a square of the
// tolerance around the finger, then each cluster read from the pins source (D126); and the map's
// zoom, which a cluster's press is decided by with the zoom it splits at (D118). A press reported
// with no hit hit nothing, which clears the selection (D139), so a query that answers nothing, or a
// cluster that cannot be read, fails the press.
async function overviewPressAt(
  press: MapPressFeature,
  map: Mapbox.MapView,
  pinsSource: RefObject<Mapbox.ShapeSource | null>,
  tolerance: number,
): Promise<OverviewPress> {
  const { screenPointX, screenPointY } = press.properties
  const [found, zoom] = await Promise.all([
    map.queryRenderedFeaturesInRect(pressBox(screenPointX, screenPointY, tolerance), undefined, [...OVERVIEW_PRESS_LAYERS]),
    map.getZoom(),
  ])
  if (found == null) throw new Error('the press query answered nothing')
  const hits = sortHits(found.features)
  const source = pinsSource.current
  if (source == null && hits.clusters.length > 0) throw new Error('a cluster was hit with no pins source')
  const clusters = source == null ? [] : await Promise.all(hits.clusters.map((cluster) => clusterHit(source, cluster)))
  const [lng, lat] = press.geometry.coordinates
  return { point: [lng, lat], zoom, pins: hits.pins, lines: hits.lines, clusters }
}

// Reports every press on the map with what of the overview it hit. A press whose query fails, as
// during a style reload, is reported to no one; that failure and one in handling the press are
// logged.
export function useOverviewPress(
  pinsSource: RefObject<Mapbox.ShapeSource | null>,
  tolerance: number,
  onPress: (press: OverviewPress) => void,
): void {
  const listener = useCallback(
    (press: MapPressFeature, map: Mapbox.MapView) => {
      void overviewPressAt(press, map, pinsSource, tolerance)
        .then(onPress)
        .catch((error: unknown) => logEvent('warn', 'map', 'overview press failed', { errorClass: errorClass(error) }))
    },
    [pinsSource, tolerance, onPress],
  )
  useMapPress(listener)
}
