import { useMapStore } from '../store/mapStore'
import { useLoadedEntity } from '../components/useLoadedEntity'

// `mutationVersion` is the store's count of mutations to the collection: it changes exactly when the entity may have changed, so a focus refresh of the list
// does not re-read the entity.
export function useSelectedEntity<T extends { id: number }>(
  kind: 'trail' | 'activity',
  load: (id: number) => Promise<T | null>,
  mutationVersion: number,
): T | null {
  const selection = useMapStore((s) => s.selection)
  const clearSelection = useMapStore((s) => s.clearSelection)
  const entityId = selection?.kind === kind ? selection.id : null
  // An entity that is gone or unreadable leaves the map holding a selection that can never resolve,
  // so drop it. Nothing had opened yet, so there is no dialog: the hook logs the detail.
  return useLoadedEntity(entityId, load, {
    label: kind,
    version: mutationVersion,
    onUnavailable: clearSelection,
  }).entity
}
