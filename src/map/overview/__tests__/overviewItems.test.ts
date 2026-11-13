import { overviewItems } from '../overviewItems'
import type { OverviewGeometry } from '../../../data/geo/overview'

const LINE = '{"type":"MultiLineString","coordinates":[[[6.1,45.1],[6.2,45.2]]]}' as OverviewGeometry
const trail = (id: number, overviewGeometry: OverviewGeometry | null = LINE) => ({ id, overviewGeometry })
const activity = (id: number, linkedTrailId: number | null, overviewGeometry: OverviewGeometry | null = LINE) => ({
  id, linkedTrailId, overviewGeometry,
})

describe('overviewItems', () => {
  it('gives every trail and activity a key of its own, its class and its stored geometry', () => {
    expect(overviewItems([trail(1)], [activity(1, null)])).toEqual([
      { key: 'trail-1', class: 'trail', geometry: LINE },
      { key: 'activity-1', class: 'activity', geometry: LINE },
    ])
  })

  it('classes an activity linked to one of the trails as linked', () => {
    expect(overviewItems([trail(7)], [activity(2, 7)]).map((i) => i.class)).toEqual(['trail', 'linkedActivity'])
  })

  it('classes an activity whose trail is not among the trails as tied to none, so it keeps its line', () => {
    expect(overviewItems([trail(7)], [activity(2, 8)]).map((i) => i.class)).toEqual(['trail', 'activity'])
  })

  it('leaves out a row with no overview geometry yet', () => {
    expect(overviewItems([trail(1, null), trail(2)], [activity(3, null, null)]).map((i) => i.key)).toEqual(['trail-2'])
  })
})
