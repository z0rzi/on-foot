import React, { forwardRef, useImperativeHandle, useRef } from 'react'
import Mapbox, { type MapState } from '@rnmapbox/maps'
import type {
  MapProvider, MapViewProps, CameraProps, TerrainProps, CameraHandle,
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
    onCameraChanged={(e: MapState) =>
      onCameraChanged?.({
        isUserInteraction: !!e?.gestures?.isGestureActive,
        heading: e?.properties?.heading ?? 0,
        pitch: e?.properties?.pitch ?? 0,
      })
    }
  >
    {children}
  </Mapbox.MapView>
)

const Camera = forwardRef<CameraHandle, CameraProps>((props, ref) => {
  const inner = useRef<Mapbox.Camera>(null)
  useImperativeHandle(ref, () => ({
    setCamera: (cfg: CameraProps) =>
      inner.current?.setCamera({
        centerCoordinate: cfg.centerCoordinate,
        zoomLevel: cfg.zoomLevel,
        pitch: cfg.pitch,
        heading: cfg.heading,
        animationDuration: cfg.animationDuration ?? 0,
      }),
  }))
  return (
    <Mapbox.Camera
      ref={inner}
      {...props}
      followUserMode={props.followUserMode as unknown as Mapbox.UserTrackingMode | undefined}
    />
  )
})

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
