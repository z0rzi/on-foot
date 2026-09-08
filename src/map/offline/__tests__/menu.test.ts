import { offlineMenuItems } from '../menu'
import type { OfflineBadgeState } from '../types'

describe('offlineMenuItems', () => {
  test('none → download only', () => {
    const state: OfflineBadgeState = { kind: 'none' }
    expect(offlineMenuItems(state)).toEqual([{ action: 'download', label: 'Download offline map' }])
  })

  test('available → edit, then remove (danger)', () => {
    const state: OfflineBadgeState = { kind: 'available', styleIds: ['outdoors'] }
    expect(offlineMenuItems(state)).toEqual([
      { action: 'edit', label: 'Edit offline map' },
      { action: 'remove', label: 'Remove offline map', danger: true },
    ])
  })

  test('failed → retry, edit, then remove (danger)', () => {
    const state: OfflineBadgeState = { kind: 'failed' }
    expect(offlineMenuItems(state)).toEqual([
      { action: 'retry', label: 'Retry download' },
      { action: 'edit', label: 'Edit offline map' },
      { action: 'remove', label: 'Remove offline map', danger: true },
    ])
  })

  test('downloading → cancel only (danger)', () => {
    const state: OfflineBadgeState = { kind: 'downloading', pct: 40, styleIds: ['outdoors'] }
    expect(offlineMenuItems(state)).toEqual([{ action: 'cancel', label: 'Cancel download', danger: true }])
  })
})
