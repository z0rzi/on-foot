import { pinsFile } from '../overviewPinsFile'
import type { OverviewPin } from '../../../provider/types'

describe('the pins file', () => {
  it('holds one point per pin at its start, carrying what its layers draw', () => {
    const pins: OverviewPin[] = [
      { key: 'trail-2', position: [6.86941, 45.92371], kind: 'completedTrail', tag: '✓3 · 12.4 km', dimmed: false, rank: 0 },
      { key: 'activity-13', position: [-1.5, -45.2], kind: 'activity', tag: '11.0 km', dimmed: true, rank: 3 },
    ]
    expect(JSON.parse(pinsFile(pins))).toEqual({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { key: 'trail-2', kind: 'completedTrail', tag: '✓3 · 12.4 km', dimmed: false, rank: 0 },
          geometry: { type: 'Point', coordinates: [6.86941, 45.92371] },
        },
        {
          type: 'Feature',
          properties: { key: 'activity-13', kind: 'activity', tag: '11.0 km', dimmed: true, rank: 3 },
          geometry: { type: 'Point', coordinates: [-1.5, -45.2] },
        },
      ],
    })
  })

  it('is an empty collection with no pin, so a clustered source holds nothing', () =>
    expect(JSON.parse(pinsFile([]))).toEqual({ type: 'FeatureCollection', features: [] }))
})
