import { linesFile, linesFileCounts } from '../overviewLinesFile'
import type { OverviewItem } from '../../../provider/types'

const LINE = '{"type":"MultiLineString","coordinates":[[[6.86941,45.92371],[6.87,45.924]],[[6.9,45.93],[6.91,45.94],[6.92,45.95]]]}'
const EMPTY = '{"type":"MultiLineString","coordinates":[]}'

describe('the lines file', () => {
  it('holds one feature per item, carrying its key and class beside its geometry', () => {
    const items: OverviewItem[] = [
      { key: 'trail-1', class: 'trail', geometry: LINE },
      { key: 'activity-2', class: 'linkedActivity', geometry: LINE },
    ]
    expect(JSON.parse(linesFile(items))).toEqual({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: { key: 'trail-1', class: 'trail' }, geometry: JSON.parse(LINE) },
        { type: 'Feature', properties: { key: 'activity-2', class: 'linkedActivity' }, geometry: JSON.parse(LINE) },
      ],
    })
  })

  it('is an empty collection with no item', () => {
    expect(JSON.parse(linesFile([]))).toEqual({ type: 'FeatureCollection', features: [] })
  })

  it('keeps an item whose geometry is empty as a feature with no line', () => {
    expect(JSON.parse(linesFile([{ key: 'activity-3', class: 'activity', geometry: EMPTY }]))).toEqual({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: { key: 'activity-3', class: 'activity' }, geometry: { type: 'MultiLineString', coordinates: [] } },
      ],
    })
  })

  it('stays valid whatever characters a key holds', () => {
    const parsed = JSON.parse(linesFile([{ key: 'a "quoted" \\ key', class: 'trail', geometry: EMPTY }]))
    expect(parsed.features[0].properties.key).toBe('a "quoted" \\ key')
  })
})

describe('what the lines file holds, for the log', () => {
  it('counts the trails, the activities linked or not, and every position', () => {
    expect(
      linesFileCounts([
        { key: 'trail-1', class: 'trail', geometry: LINE },
        { key: 'activity-2', class: 'linkedActivity', geometry: LINE },
        { key: 'activity-3', class: 'activity', geometry: EMPTY },
      ]),
    ).toEqual({ trails: 1, activities: 2, points: 10 })
  })

  it('counts negative coordinates as positions too', () => {
    const west = '{"type":"MultiLineString","coordinates":[[[-1.5,-45.2],[-1.6,-45.3]]]}'
    expect(linesFileCounts([{ key: 'trail-1', class: 'trail', geometry: west }]).points).toBe(2)
  })

  it('holds no coordinate', () => {
    expect(JSON.stringify(linesFileCounts([{ key: 'trail-1', class: 'trail', geometry: LINE }]))).not.toContain('45.92371')
  })
})
