import { LOG_AREAS, LogEntry } from '../../data/log/types'
import { filterByArea } from '../filterByArea'

const entry = (id: number, area: LogEntry['area']): LogEntry => ({
  id,
  t: id,
  level: 'info',
  area,
  message: `message ${id}`,
  detail: null,
})

const entries = [entry(1, 'capture'), entry(2, 'launch'), entry(3, 'capture'), entry(4, 'recording')]

describe('filterByArea', () => {
  it('keeps every entry when every area is on', () => {
    expect(filterByArea(entries, new Set(LOG_AREAS))).toEqual(entries)
  })

  it('drops the capture entries when capture is off', () => {
    const areas = new Set(LOG_AREAS.filter((area) => area !== 'capture'))
    expect(filterByArea(entries, areas).map((e) => e.id)).toEqual([2, 4])
  })

  it('keeps nothing when every area is off', () => {
    expect(filterByArea(entries, new Set())).toEqual([])
  })

  it('keeps nothing when no entry is in an enabled area', () => {
    expect(filterByArea(entries, new Set(['map']))).toEqual([])
  })
})
