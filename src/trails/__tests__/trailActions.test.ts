import { trailActionItems, type TrailActionHandlers } from '../trailActions'
import type { GpxPoint } from '../../data/trails/types'
import type { TrailOfflineStatus } from '../../map/offline/types'

describe('trailActionItems', () => {
  const start: GpxPoint = { lat: 45.123456, lng: 5.654321, ele: null }
  const handlers = (): TrailActionHandlers => ({
    navigateTo: jest.fn(),
    offline: { download: jest.fn(), edit: jest.fn(), remove: jest.fn(), retry: jest.fn(), cancel: jest.fn() },
    edit: jest.fn(),
    remove: jest.fn(),
  })
  const labels = (offline: TrailOfflineStatus, from: GpxPoint | null = start) =>
    trailActionItems(from, offline, handlers()).map((item) => item.label)

  test('no offline map: navigate, download, edit, delete', () => {
    expect(labels({ kind: 'none' })).toEqual(['Navigate to start', 'Download offline map', 'Edit trail', 'Delete trail'])
  })

  test('offline map available: edit and remove it between navigate and the trail items', () => {
    expect(labels({ kind: 'available', styleIds: ['outdoors'] })).toEqual([
      'Navigate to start',
      'Edit offline map',
      'Remove offline map',
      'Edit trail',
      'Delete trail',
    ])
  })

  test('download failed: retry first among the offline items', () => {
    expect(labels({ kind: 'failed' })).toEqual([
      'Navigate to start',
      'Retry download',
      'Edit offline map',
      'Remove offline map',
      'Edit trail',
      'Delete trail',
    ])
  })

  test('downloading: cancel is the only offline item', () => {
    expect(labels({ kind: 'downloading', pct: 40, styleIds: ['outdoors'] })).toEqual([
      'Navigate to start',
      'Cancel download',
      'Edit trail',
      'Delete trail',
    ])
  })

  test('with no start point, navigate is absent', () => {
    expect(labels({ kind: 'none' }, null)).toEqual(['Download offline map', 'Edit trail', 'Delete trail'])
  })

  test('only the destructive items are red', () => {
    const items = trailActionItems(start, { kind: 'available', styleIds: [] }, handlers())
    expect(items.filter((item) => item.danger).map((item) => item.label)).toEqual(['Remove offline map', 'Delete trail'])
  })

  test('each item calls its own handler', () => {
    const h = handlers()
    const items = trailActionItems(start, { kind: 'failed' }, h)
    const press = (label: string) => items.find((item) => item.label === label)?.onPress()
    press('Navigate to start')
    expect(h.navigateTo).toHaveBeenCalledWith(start)
    press('Retry download')
    expect(h.offline.retry).toHaveBeenCalledTimes(1)
    press('Edit trail')
    expect(h.edit).toHaveBeenCalledTimes(1)
    press('Delete trail')
    expect(h.remove).toHaveBeenCalledTimes(1)
    expect(h.offline.remove).not.toHaveBeenCalled()
  })
})
