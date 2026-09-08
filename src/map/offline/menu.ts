import type { OfflineBadgeState } from './types'

export type OfflineMenuAction = 'download' | 'edit' | 'remove' | 'retry' | 'cancel'

export interface OfflineMenuItem {
  action: OfflineMenuAction
  label: string
  danger?: boolean
}

export function offlineMenuItems(state: OfflineBadgeState): OfflineMenuItem[] {
  switch (state.kind) {
    case 'none':
      return [{ action: 'download', label: 'Download offline map' }]
    case 'available':
      return [
        { action: 'edit', label: 'Edit offline map' },
        { action: 'remove', label: 'Remove offline map', danger: true },
      ]
    case 'failed':
      return [
        { action: 'retry', label: 'Retry download' },
        { action: 'edit', label: 'Edit offline map' },
        { action: 'remove', label: 'Remove offline map', danger: true },
      ]
    case 'downloading':
      return [{ action: 'cancel', label: 'Cancel download', danger: true }]
  }
}
