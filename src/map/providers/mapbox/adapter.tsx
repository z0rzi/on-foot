import React, { forwardRef, useImperativeHandle, useRef } from 'react'
import Mapbox, { type MapState } from '@rnmapbox/maps'
import type {
  MapProvider, MapViewProps, CameraProps, TerrainProps, CameraController,
} from '../../provider/types'
import { mapboxCapabilities } from './capabilities'
import { TERRAIN_DEM } from './styles'
import { MAPBOX_ACCESS_TOKEN } from './token'

Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN)

const View = ({ styleURL, onCameraChanged, style, children }: MapViewProps) => (
  <Mapbox.MapView
    style={style}
    styleURL={styleURL}
    scaleBarEnabled={false}
    logoEnabled={false}
    attributionEnabled={false}
    compassEnabled={false}
    onCameraChanged={(e: MapState) => onCameraChanged?.({ heading: e?.properties?.heading ?? 0 })}
  >
    {children}
  </Mapbox.MapView>
)

// The camera is driven declaratively (follow props / pitch) — see MapCanvas. The one imperative
// affordance is resetNorth: a one-shot rotate to bearing 0, only ever called when follow is off
// (so the rnmapbox "imperative move is a no-op while following" trap does not apply). Pull out
// fields whose neutral shape differs from rnmapbox's before spreading the rest.
const Camera = forwardRef<CameraController, CameraProps>(
  ({ followUserMode, onUserTrackingModeChange, ...rest }, ref) => {
    const inner = useRef<Mapbox.Camera>(null)
    useImperativeHandle(ref, () => ({
      resetNorth: (animated: boolean) =>
        inner.current?.setCamera({ heading: 0, animationDuration: animated ? 300 : 0 }),
    }))
    return (
      <Mapbox.Camera
        ref={inner}
        {...rest}
        followUserMode={followUserMode as unknown as Mapbox.UserTrackingMode | undefined}
        onUserTrackingModeChange={
          onUserTrackingModeChange
            ? (e) => onUserTrackingModeChange(!!e?.nativeEvent?.payload?.followUserLocation)
            : undefined
        }
      />
    )
  },
)

const Terrain = ({ exaggeration }: TerrainProps) => (
  <Mapbox.RasterDemSource id="terrain-dem" url={TERRAIN_DEM.url} tileSize={TERRAIN_DEM.tileSize}>
    <Mapbox.Terrain style={{ exaggeration }} />
  </Mapbox.RasterDemSource>
)

const UserPuck = () => (
  <Mapbox.LocationPuck puckBearing="heading" puckBearingEnabled visible pulsing={{ isEnabled: true }} />
)

export const mapboxProvider: MapProvider = {
  capabilities: mapboxCapabilities,
  components: { View, Camera, Terrain, UserPuck },
}
