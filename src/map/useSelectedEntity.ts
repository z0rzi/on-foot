import { useEffect, useState } from 'react'
import { useMapStore } from '../store/mapStore'

// `load` sits in the effect's dep array, so callers pass a module-level function — an inline
// arrow would reload on every render. `revalidateOn` is never read: it is the store list whose
// change re-runs the load.
export function useSelectedEntity<T extends { id: number }>(
  kind: 'trail' | 'activity',
  load: (id: number) => Promise<T | null>,
  revalidateOn: unknown,
): T | null {
  const selection = useMapStore((s) => s.selection)
  const clearSelection = useMapStore((s) => s.clearSelection)
  // Keyed to the id it loaded, so a stale result (e.g. mid A→B switch, or after deselect) is
  // derived away during render instead of cleared with a setState-in-effect.
  const [loaded, setLoaded] = useState<{ id: number; entity: T | null } | null>(null)
  const entityId = selection?.kind === kind ? selection.id : null

  useEffect(() => {
    if (entityId == null) return
    let active = true
    void load(entityId).then((entity) => {
      if (!active) return
      if (entity == null) clearSelection()
      setLoaded({ id: entityId, entity })
    })
    return () => {
      active = false
    }
  }, [entityId, revalidateOn, clearSelection, load])

  return entityId != null && loaded?.id === entityId ? loaded.entity : null
}
