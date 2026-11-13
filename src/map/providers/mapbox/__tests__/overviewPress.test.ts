import { OVERVIEW_PRESS_LAYERS, leafKeys, pressBox, sortHits } from '../overviewPress'

type Props = Record<string, unknown>
const line = (properties: Props): GeoJSON.Feature => ({
  type: 'Feature', properties, geometry: { type: 'LineString', coordinates: [[7, 45], [7.1, 45.1]] },
})
const point = (properties: Props): GeoJSON.Feature => ({
  type: 'Feature', properties, geometry: { type: 'Point', coordinates: [7, 45] },
})
const cluster = (id: number, count: number) => point({ cluster: true, cluster_id: id, point_count: count })

describe('the overview press query (D126)', () => {
  test('queries a square of twice the tolerance around the finger, as [top, left, bottom, right] in dp', () =>
    expect(pressBox(100, 200, 22)).toEqual([178, 78, 222, 122]))

  test('queries the overview’s own layers: every line layer, the teardrop, the tag and the cluster', () =>
    expect([...OVERVIEW_PRESS_LAYERS].sort()).toEqual([
      'overview-cluster',
      'overview-lines-dimmed',
      'overview-lines-family',
      'overview-lines-shown',
      'overview-pin-outline',
      'overview-pin-tag',
    ]))
})

describe('sorting the features a press hit (D126)', () => {
  test('tells pins, lines and clusters apart by geometry and cluster count', () => {
    const hits = sortHits([line({ key: 'trail-1' }), point({ key: 'activity-4' }), cluster(7, 3)])
    expect(hits.pins).toEqual(['activity-4'])
    expect(hits.lines).toEqual(['trail-1'])
    expect(hits.clusters).toEqual([cluster(7, 3)])
  })

  test('reports a line hit once per map tile once, and a teardrop and its tag as one pin', () => {
    const hits = sortHits([
      line({ key: 'trail-1' }),
      line({ key: 'trail-1' }),
      { ...line({ key: 'trail-2' }), geometry: { type: 'MultiLineString', coordinates: [] } },
      point({ key: 'activity-4' }),
      point({ key: 'activity-4' }),
    ])
    expect(hits).toEqual({ pins: ['activity-4'], lines: ['trail-1', 'trail-2'], clusters: [] })
  })

  test('reports a cluster hit twice once', () =>
    expect(sortHits([cluster(7, 3), cluster(7, 3), cluster(8, 2)]).clusters).toEqual([cluster(7, 3), cluster(8, 2)]))

  test('ignores a feature with no key that is no cluster', () =>
    expect(sortHits([line({}), point({ key: 4 }), { ...point({ key: 'x' }), properties: null }])).toEqual({
      pins: [], lines: [], clusters: [],
    }))

  test('reads a cluster’s keys from its leaves', () =>
    expect(leafKeys({ type: 'FeatureCollection', features: [point({ key: 'trail-1' }), point({}), point({ key: 'activity-4' })] })).toEqual([
      'trail-1', 'activity-4',
    ]))
})
