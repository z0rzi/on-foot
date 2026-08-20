import React from 'react'
import Mapbox from '@rnmapbox/maps'
import type {
  MapProvider, MapViewProps, CameraProps, TerrainProps,
} from '../../provider/types'
import { mapboxCapabilities } from './capabilities'
import { TERRAIN_DEM } from './styles'
import { MAPBOX_ACCESS_TOKEN } from './token'

Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN)

const View = ({ styleURL, style, children }: MapViewProps) => (
  <Mapbox.MapView
    style={style}
    styleURL={styleURL}
    scaleBarEnabled={false}
    logoEnabled={false}
    attributionEnabled={false}
    compassEnabled={false}
  >
    {children}
  </Mapbox.MapView>
)

// The camera is driven declaratively (follow props / pitch) — see MapCanvas. Pull out fields
// whose neutral shape differs from rnmapbox's before spreading the rest.
const Camera = ({ followUserMode, onUserTrackingModeChange, ...rest }: CameraProps) => (
  <Mapbox.Camera
    {...rest}
    followUserMode={followUserMode as unknown as Mapbox.UserTrackingMode | undefined}
    onUserTrackingModeChange={
      onUserTrackingModeChange
        ? (e) => onUserTrackingModeChange(!!e?.nativeEvent?.payload?.followUserLocation)
        : undefined
    }
  />
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
