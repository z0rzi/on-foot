import { logEvent } from '../log'
import { routeTiming, type RouteTiming } from './routeTiming'

export type RoutedEntity = { geometry: { segments: readonly (readonly unknown[])[] } }

// T-4: what showing a route costs before anything is derived from it. The load is the SQLite read
// and the JSON.parse of the stored geometry, and both block the JS thread. A load that finds
// nothing or fails writes no timing: useLoadedEntity logs those.
export function timedRouteLoad<T extends RoutedEntity>(
  kind: RouteTiming['kind'],
  load: (id: number) => Promise<T | null>,
): (id: number) => Promise<T | null> {
  return async (id) => {
    const start = performance.now()
    const entity = await load(id)
    if (entity) {
      logEvent('info', 'map', 'route loaded', routeTiming(kind, entity.geometry.segments, performance.now() - start))
    }
    return entity
  }
}
