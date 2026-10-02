import { trailActionItems } from '../trailActions'
import type { ActionItem } from '../../components/ActionsMenu'
import type { GpxPoint } from '../../data/trails/types'

describe('trailActionItems', () => {
  const start: GpxPoint = { lat: 45.123456, lng: 5.654321, ele: null }
  const offlineItems: ActionItem[] = [
    { label: 'Edit offline map', onPress: () => {} },
    { label: 'Remove offline map', danger: true, onPress: () => {} },
  ]

  test('with a start point, navigate is first, ahead of the offline items', () => {
    const items = trailActionItems(start, offlineItems, () => {})
    expect(items[0]).toMatchObject({ label: 'Navigate to start' })
    expect(items.slice(1).map((item) => item.label)).toEqual(offlineItems.map((item) => item.label))
  })

  test('with no start point, only the offline items are returned, in order', () => {
    const items = trailActionItems(null, offlineItems, () => {})
    expect(items.map((item) => item.label)).toEqual(offlineItems.map((item) => item.label))
    expect(items.some((item) => item.label === 'Navigate to start')).toBe(false)
  })

  test('the navigate item calls navigateTo exactly once with the given start point', () => {
    const navigateTo = jest.fn()
    const items = trailActionItems(start, offlineItems, navigateTo)
    items[0].onPress()
    expect(navigateTo).toHaveBeenCalledTimes(1)
    expect(navigateTo).toHaveBeenCalledWith(start)
  })

  test('the offline items pass through unchanged, danger flag included', () => {
    const items = trailActionItems(start, offlineItems, () => {})
    expect(items.slice(1)).toEqual(offlineItems)
  })
})
