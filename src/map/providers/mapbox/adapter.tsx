import React, { forwardRef, useImperativeHandle, useRef } from 'react'
import Mapbox, { type MapState } from '@rnmapbox/maps'
import type {
  MapProvider, MapViewProps, CameraProps, TerrainProps, CameraController, TrailOverlayProps,
  RouteLineProps,
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
      fitBounds: (ne, sw, padding, duration) =>
        inner.current?.fitBounds(ne, sw, padding, duration),
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

// The default 2D puck is a radially symmetric dot, so heading rotation is invisible on it. A
// custom bearingImage — a dot with a chevron above it, rendered at 3x and scaled back down —
// makes the facing direction visible, mirroring the Kotlin app's LocationPuck2D bearing arrow.
const puckBearingArrow = require('./puck-bearing-arrow.png')

const UserPuck = () => (
  <>
    <Mapbox.Images images={{ 'puck-bearing-arrow': puckBearingArrow }} />
    <Mapbox.LocationPuck
      puckBearing="heading"
      puckBearingEnabled
      visible
      bearingImage="puck-bearing-arrow"
      scale={1 / 3}
      pulsing={{ isEnabled: true }}
    />
  </>
)

const TrailOverlay = ({
  line, endpoints, color, lineWidth, arrowImage, arrowSpacing, arrowSize,
  endpointRadius, endpointStrokeColor, endpointStrokeWidth,
}: TrailOverlayProps) => {
  const lineShape = {
    type: 'Feature' as const,
    geometry: { type: 'LineString' as const, coordinates: line },
    properties: {},
  }
  const endpointShape = {
    type: 'FeatureCollection' as const,
    features: endpoints.map((coord) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: coord },
      properties: {},
    })),
  }
  const lineChildren = [
    <Mapbox.LineLayer
      key="line"
      id="trail-line"
      style={{ lineColor: color, lineWidth, lineCap: 'round', lineJoin: 'round' }}
    />,
    arrowImage != null ? (
      <Mapbox.SymbolLayer
        key="arrows"
        id="trail-arrows"
        style={{
          symbolPlacement: 'line',
          symbolSpacing: arrowSpacing,
          iconImage: 'trail-arrow',
          iconSize: arrowSize,
          iconAllowOverlap: true,
          iconRotationAlignment: 'map',
        }}
      />
    ) : null,
  ].filter((el): el is React.ReactElement => el != null)
  return (
    <>
      {arrowImage != null && <Mapbox.Images images={{ 'trail-arrow': arrowImage }} />}
      <Mapbox.ShapeSource id="trail-line-source" shape={lineShape}>
        {lineChildren}
      </Mapbox.ShapeSource>
      <Mapbox.ShapeSource id="trail-endpoints-source" shape={endpointShape}>
        <Mapbox.CircleLayer
          id="trail-endpoints"
          style={{
            circleColor: color,
            circleRadius: endpointRadius,
            circleStrokeColor: endpointStrokeColor,
            circleStrokeWidth: endpointStrokeWidth,
          }}
        />
      </Mapbox.ShapeSource>
    </>
  )
}

const RouteLine = ({ line, color, lineWidth }: RouteLineProps) => {
  const shape = {
    type: 'Feature' as const,
    geometry: { type: 'LineString' as const, coordinates: line },
    properties: {},
  }
  return (
    <Mapbox.ShapeSource id="route-line-source" shape={shape}>
      <Mapbox.LineLayer
        id="route-line"
        style={{ lineColor: color, lineWidth, lineCap: 'round', lineJoin: 'round' }}
      />
    </Mapbox.ShapeSource>
  )
}

export const mapboxProvider: MapProvider = {
  capabilities: mapboxCapabilities,
  components: { View, Camera, Terrain, UserPuck, TrailOverlay, RouteLine },
}
