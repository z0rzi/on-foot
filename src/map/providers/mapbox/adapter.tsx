import React, { createContext, forwardRef, useContext, useImperativeHandle, useRef, useState } from 'react'
import Mapbox, { type MapState } from '@rnmapbox/maps'
import type {
  MapProvider, MapViewProps, CameraProps, TerrainProps, CameraController, RouteOverlayProps,
  ScrubMarkerProps, UserPuckProps,
} from '../../provider/types'
import { mapboxCapabilities } from './capabilities'
import { mapboxOfflineController } from './offline'
import { trackingModeFor } from './followMode'
import { cameraStopFor, framingFromMapState } from './camera'
import { TERRAIN_DEM } from './styles'
import { MAPBOX_ACCESS_TOKEN } from './token'

void Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN)

const TRAIL_CASING = '#333333'

// Whether the map has finished loading once; the Camera holds follow until then.
const MapLoadedContext = createContext(false)

// Before the map has loaded, rnmapbox's Android map reports the camera it holds before the initial
// camera is applied (the style's default), and reports no change when the initial camera lands. So
// camera changes are only forwarded once the map has loaded: earlier ones describe a camera nobody
// sees, and would overwrite the heading and the last camera with it.
const View = ({ styleURL, onCameraChanged, onMapLoaded, style, children }: MapViewProps) => {
  const [loaded, setLoaded] = useState(false)
  return (
    <Mapbox.MapView
      style={style}
      styleURL={styleURL}
      scaleBarEnabled={false}
      logoEnabled={false}
      attributionEnabled={false}
      compassEnabled={false}
      onCameraChanged={(e: MapState) => {
        const framing = framingFromMapState(e)
        if (framing && loaded) onCameraChanged?.(framing)
      }}
      onDidFinishLoadingMap={() => {
        setLoaded(true)
        onMapLoaded?.()
      }}
    >
      <MapLoadedContext.Provider value={loaded}>{children}</MapLoadedContext.Provider>
    </Mapbox.MapView>
  )
}

// The camera is driven declaratively (follow props / pitch) — see MapCanvas. Two imperative
// affordances remain, both only ever called when follow is off, so the rnmapbox "imperative move is
// a no-op while following" trap does not apply: resetNorth, a one-shot rotate to bearing 0, and
// fitBounds, which frames a trail. The port describes both (`src/map/provider/types.ts`). Pull out
// fields whose neutral shape differs from rnmapbox's before spreading the rest.
// The initial camera, read at mount, is rnmapbox's `defaultSettings`. On Android the native camera
// applies it only once the map view is attached to the window, but starts a follow transition at
// once, from the whole-earth default; that transition then owns the camera and the initial camera
// is lost. So with an initial camera, follow is held off until the map has loaded (the view is
// attached by then), and the follow transition starts from the initial camera.
const Camera = forwardRef<CameraController, CameraProps>(
  ({ followUserMode, onUserTrackingModeChange, initialCamera, followUserLocation, ...rest }, ref) => {
    const inner = useRef<Mapbox.Camera>(null)
    const [defaultSettings] = useState(() => initialCamera && cameraStopFor(initialCamera))
    const mapLoaded = useContext(MapLoadedContext)
    const holdFollow = defaultSettings != null && !mapLoaded
    useImperativeHandle(ref, () => ({
      resetNorth: (animated: boolean) =>
        inner.current?.setCamera({ heading: 0, animationDuration: animated ? 300 : 0 }),
      fitBounds: (ne, sw, [paddingTop, paddingRight, paddingBottom, paddingLeft], duration, pitch) =>
        inner.current?.setCamera({
          bounds: { ne, sw },
          padding: { paddingTop, paddingRight, paddingBottom, paddingLeft },
          pitch,
          animationDuration: duration,
        }),
    }))
    return (
      <Mapbox.Camera
        ref={inner}
        {...rest}
        defaultSettings={defaultSettings}
        followUserLocation={followUserLocation && !holdFollow}
        minZoomLevel={mapboxCapabilities.minZoom}
        maxZoomLevel={mapboxCapabilities.maxZoom}
        followUserMode={followUserMode && trackingModeFor(followUserMode)}
        onUserTrackingModeChange={
          onUserTrackingModeChange
            ? (e) => onUserTrackingModeChange(!!e?.nativeEvent?.payload?.followUserLocation)
            : undefined
        }
      />
    )
  },
)
Camera.displayName = 'Camera'

const Terrain = ({ exaggeration }: TerrainProps) => (
  <Mapbox.RasterDemSource id="terrain-dem" url={TERRAIN_DEM.url} tileSize={TERRAIN_DEM.tileSize}>
    <Mapbox.Terrain style={{ exaggeration }} />
  </Mapbox.RasterDemSource>
)

// The default 2D puck is a radially symmetric dot, so heading rotation is invisible on it. A
// custom bearingImage — a dot with a chevron above it — makes the facing direction visible,
// mirroring the Kotlin app's LocationPuck2D bearing arrow. The image is high-resolution and
// scaled down so it stays crisp. Once any puck image is custom, rnmapbox hands Mapbox no image
// for the unset slots and Mapbox logs an error per re-render, so top and shadow are filled with
// a transparent pixel.
const puckBearingArrow = require('./puck-bearing-arrow.png')
const puckTransparent = require('./puck-transparent.png')

const UserPuck = ({ scale }: UserPuckProps) => (
  <>
    <Mapbox.Images
      images={{ 'puck-bearing-arrow': puckBearingArrow, 'puck-transparent': puckTransparent }}
    />
    <Mapbox.LocationPuck
      puckBearing="heading"
      puckBearingEnabled
      visible
      topImage="puck-transparent"
      bearingImage="puck-bearing-arrow"
      shadowImage="puck-transparent"
      scale={scale}
      pulsing={{ isEnabled: true }}
    />
  </>
)

const multiLine = (lines: [number, number][][]) => ({
  type: 'Feature' as const,
  geometry: { type: 'MultiLineString' as const, coordinates: lines },
  properties: {},
})

const RouteOverlay = ({
  idPrefix, lines, connectors, connectorDashArray, color, lineWidth, colouredLines, casing,
  arrowImage, arrowSpacing, arrowSize, endpoints,
}: RouteOverlayProps) => {
  const arrowsLayer =
    arrowImage != null ? (
      <Mapbox.SymbolLayer
        key="arrows"
        id={`${idPrefix}-arrows`}
        style={{
          symbolPlacement: 'line',
          symbolSpacing: arrowSpacing,
          iconImage: 'trail-arrow',
          iconSize: arrowSize,
          iconAllowOverlap: true,
          iconRotationAlignment: 'map',
        }}
      />
    ) : null
  const useColoured = colouredLines != null && colouredLines.length > 0
  const slopeShape = {
    type: 'FeatureCollection' as const,
    features: (colouredLines ?? []).map((l) => ({
      type: 'Feature' as const,
      geometry: { type: 'LineString' as const, coordinates: l.coordinates },
      properties: { color: l.color },
    })),
  }
  return (
    <>
      {arrowImage != null && <Mapbox.Images images={{ 'trail-arrow': arrowImage }} />}
      {useColoured ? (
        <Mapbox.ShapeSource id={`${idPrefix}-slope-source`} shape={slopeShape}>
          {[
            casing && (
              <Mapbox.LineLayer
                key="slope-casing"
                id={`${idPrefix}-slope-casing`}
                style={{ lineColor: TRAIL_CASING, lineWidth: lineWidth + 3, lineCap: 'round', lineJoin: 'round' }}
              />
            ),
            <Mapbox.LineLayer
              key="slope-line"
              id={`${idPrefix}-slope-line`}
              style={{ lineColor: ['get', 'color'], lineWidth, lineCap: 'round', lineJoin: 'round' }}
            />,
            arrowsLayer,
          ].filter((el): el is React.ReactElement => !!el)}
        </Mapbox.ShapeSource>
      ) : (
        lines.length > 0 && (
          <Mapbox.ShapeSource id={`${idPrefix}-line-source`} shape={multiLine(lines)}>
            {[
              casing && (
                <Mapbox.LineLayer
                  key="casing"
                  id={`${idPrefix}-line-casing`}
                  style={{ lineColor: TRAIL_CASING, lineWidth: lineWidth + 3, lineCap: 'round', lineJoin: 'round' }}
                />
              ),
              <Mapbox.LineLayer
                key="line"
                id={`${idPrefix}-line`}
                style={{ lineColor: color, lineWidth, lineCap: 'round', lineJoin: 'round' }}
              />,
              arrowsLayer,
            ].filter((el): el is React.ReactElement => !!el)}
          </Mapbox.ShapeSource>
        )
      )}
      {connectors.length > 0 && (
        <Mapbox.ShapeSource id={`${idPrefix}-connector-source`} shape={multiLine(connectors)}>
          <Mapbox.LineLayer
            id={`${idPrefix}-connector`}
            style={{ lineColor: color, lineWidth, lineDasharray: connectorDashArray, lineCap: 'round' }}
          />
        </Mapbox.ShapeSource>
      )}
      {endpoints && (
        <Mapbox.ShapeSource
          id={`${idPrefix}-endpoints-source`}
          shape={{
            type: 'FeatureCollection' as const,
            features: endpoints.points.map((coord) => ({
              type: 'Feature' as const,
              geometry: { type: 'Point' as const, coordinates: coord },
              properties: {},
            })),
          }}
        >
          <Mapbox.CircleLayer
            id={`${idPrefix}-endpoints`}
            style={{
              circleColor: color,
              circleRadius: endpoints.radius,
              circleStrokeColor: endpoints.strokeColor,
              circleStrokeWidth: endpoints.strokeWidth,
            }}
          />
        </Mapbox.ShapeSource>
      )}
    </>
  )
}

const ScrubMarker = ({ coordinate, color, radius, strokeColor, strokeWidth }: ScrubMarkerProps) => (
  <Mapbox.ShapeSource
    id="scrub-marker-source"
    shape={{ type: 'Feature', geometry: { type: 'Point', coordinates: coordinate }, properties: {} }}
  >
    <Mapbox.CircleLayer
      id="scrub-marker"
      style={{ circleColor: color, circleRadius: radius, circleStrokeColor: strokeColor, circleStrokeWidth: strokeWidth }}
    />
  </Mapbox.ShapeSource>
)

export const mapboxProvider: MapProvider = {
  capabilities: mapboxCapabilities,
  components: { View, Camera, Terrain, UserPuck, RouteOverlay, ScrubMarker },
  offline: mapboxOfflineController,
}
