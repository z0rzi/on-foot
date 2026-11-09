import { useRef } from 'react'
import { Alert } from 'react-native'
import { useRouter } from 'expo-router'
import type { BottomSheetModal } from '@gorhom/bottom-sheet'
import type { Trail } from '../data/trails/types'
import { useMapCapabilities, useOfflineController } from '../map/provider'
import { useOfflineStore } from '../map/offline/offlineStore'
import { offlineStatusForTrail } from '../map/offline/status'
import type { OfflineMenuAction } from '../map/offline/menu'
import { retryTargetsForTrail } from '../map/offline/operations'
import { boundsForTrail } from '../map/offline/bounds'
import { flattenSegments, startPointOf } from '../map/geo'
import { packDescriptor } from '../map/offline/descriptor'
import { OFFLINE_MARGIN_KM } from '../map/offline/constants'
import { OfflineLayerChooser } from '../map/offline/OfflineLayerChooser'
import { guardDownload } from '../map/offline/downloadConsent'
import { ActionsMenu, type MenuAnchor } from '../components/ActionsMenu'
import { showToast } from '../components/toast'
import { openMapApp } from '../external'
import { trailActionItems } from './trailActions'
import { useDeleteTrail } from './useDeleteTrail'

// The trail's ⋮ menu, the same in the map sheet and the Trails list. The offline layer chooser
// stays mounted while the menu is closed, since a menu item opens it.
export function TrailActions({
  trail,
  anchor,
  onCloseMenu,
}: {
  trail: Trail
  anchor: MenuAnchor | null
  onCloseMenu: () => void
}) {
  const router = useRouter()
  const caps = useMapCapabilities()
  const controller = useOfflineController()
  const packs = useOfflineStore((s) => s.packs)
  const progress = useOfflineStore((s) => s.progress)
  const download = useOfflineStore((s) => s.download)
  const resume = useOfflineStore((s) => s.resume)
  const removeForTrail = useOfflineStore((s) => s.removeForTrail)
  const deleteTrail = useDeleteTrail()
  const chooserRef = useRef<BottomSheetModal>(null)

  const removeOffline = () => {
    Alert.alert('Remove offline map', `Remove the offline map for "${trail.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void removeForTrail(controller, trail.id).then(() => showToast('Offline map removed'))
        },
      },
    ])
  }

  // Retry each failed/incomplete layer: resume a pack that exists (keeps partial progress), or
  // re-issue the download for a phantom failure that left no pack behind.
  const retry = () => {
    const bounds = boundsForTrail(flattenSegments(trail.geometry.segments), OFFLINE_MARGIN_KM)
    void guardDownload(null, () => {
      retryTargetsForTrail(packs, progress, trail.id).forEach((t) => {
        if (t.hasPack) {
          resume(controller, t.id)
          return
        }
        const style = caps.styles.find((s) => s.id === t.styleId)
        if (style && bounds) download(controller, packDescriptor(trail.id, style, bounds))
      })
    })
  }

  const cancel = () => removeForTrail(controller, trail.id).then(() => showToast('Download canceled'))

  const offline: Record<OfflineMenuAction, () => void> = {
    download: () => chooserRef.current?.present(),
    edit: () => chooserRef.current?.present(),
    remove: removeOffline,
    retry,
    cancel: () => void cancel(),
  }
  // eslint-disable-next-line react-hooks/refs -- the chooser ref is read when a menu item is pressed, never during render
  const items = trailActionItems(startPointOf(trail.geometry.segments), offlineStatusForTrail(trail.id, packs, progress), {
    navigateTo: (point) => void openMapApp(point, trail.name),
    offline,
    edit: () => router.push(`/trail/${trail.id}/edit`),
    remove: () => deleteTrail(trail),
  })

  return (
    <>
      <OfflineLayerChooser ref={chooserRef} trail={trail} />
      {anchor && <ActionsMenu items={items} anchor={anchor} onClose={onCloseMenu} />}
    </>
  )
}
