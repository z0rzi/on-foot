import { createContext, useContext, useEffect, type ComponentProps } from 'react'
import type Mapbox from '@rnmapbox/maps'

// The map's own press: its geographic point, and its screen point in dp in the properties (on
// Android, rnmapbox converts the SDK's physical pixels to dp before reporting it).
export type MapPressFeature = Parameters<NonNullable<ComponentProps<typeof Mapbox.MapView>['onPress']>>[0]

// Called with the press and the map view pressed, to look up what lies under it.
export type MapPressListener = (press: MapPressFeature, map: Mapbox.MapView) => void

// The listeners to the presses on the map, for what is drawn inside it.
export const MapPressContext = createContext<Set<MapPressListener> | null>(null)

export function useMapPress(listener: MapPressListener): void {
  const listeners = useContext(MapPressContext)
  useEffect(() => {
    if (listeners == null) return
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [listeners, listener])
}
