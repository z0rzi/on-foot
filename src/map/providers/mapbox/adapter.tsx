import React, { createContext, forwardRef, useContext, useImperativeHandle, useRef, useState } from 'react'
import { StyleSheet, View as RNView } from 'react-native'
import Mapbox, { type MapState } from '@rnmapbox/maps'
import type {
  MapProvider, MapViewProps, CameraProps, TerrainProps, CameraController, RouteOverlayProps,
  ScrubMarkerProps, UserPuckProps,
} from '../../provider/types'
import { mapboxCapabilities } from './capabilities'
import { mapboxOfflineController } from './offline'
import { trackingModeFor } from './followMode'
import { cameraPaddingFor, cameraStopFor, fitCameraFor, framingFromMapState, type ViewSize } from './camera'
import { TERRAIN_DEM } from './styles'
import { TIER_ANCHORS, anchorLayerIdFor } from './tiers'
import { MAPBOX_ACCESS_TOKEN } from './token'
import { logEvent } from '../../../log'

void Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN)

const TRAIL_CASING = '#333333'

// Whether the map has finished loading once; the Camera holds follow until then.
const MapLoadedContext = createContext(false)

// The map view's size in dp once laid out; the Camera sizes its fits from it. rnmapbox's MapView
// keeps its own layout to itself, so the View measures a wrapper of the same size.
const MapSizeContext = createContext<React.RefObject<ViewSize | null>>({ current: null })

const View = ({ styleURL, onCameraChanged, onMapLoaded, style, children }: MapViewProps) => {
  const [loaded, setLoaded] = useState(false)
  const size = useRef<ViewSize | null>(null)
  return (
    <RNView
      style={style}
      onLayout={(e) => {
        size.current = { width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height }
      }}
    >
      <Mapbox.MapView
        style={StyleSheet.absoluteFill}
        styleURL={styleURL}
        scaleBarEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={false}
        onCameraChanged={(e: MapState) => {
          // Before the map has loaded, rnmapbox's Android map reports the camera it holds before
          // the initial camera is applied (the style's default), and reports no change when the
          // initial camera lands. So camera changes are only forwarded once the map has loaded:
          // earlier ones describe a camera nobody sees, and would overwrite the heading and the
          // last camera with it.
          const framing = framingFromMapState(e)
          if (framing && loaded) onCameraChanged?.(framing)
        }}
        onDidFinishLoadingMap={() => {
          setLoaded(true)
          onMapLoaded?.()
        }}
      >
        {/* rnmapbox adds a layer on top of the stack as it mounts once the style has loaded,
            unless it is given an aboveLayerID, belowLayerID or layerIndex; child order only
            orders the layers queued before the style loads. So the route tiers are held by one
            invisible anchor layer per tier, mounted in tier order as the map's first children,
            and every route overlay layer is inserted below its tier's anchor (belowLayerID,
            which waits for the anchor if it is not on the map yet). On a style reload rnmapbox
            re-adds the map's children in child order, so the anchors come back first, in order. */}
        {TIER_ANCHORS.map((id) => (
          <Mapbox.BackgroundLayer key={id} id={id} style={{ visibility: 'none' }} />
        ))}
        <MapLoadedContext.Provider value={loaded}>
          <MapSizeContext.Provider value={size}>{children}</MapSizeContext.Provider>
        </MapLoadedContext.Provider>
      </Mapbox.MapView>
    </RNView>
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
  ({ followUserMode, onUserTrackingModeChange, initialCamera, followUserLocation, followPadding, ...rest }, ref) => {
    const inner = useRef<Mapbox.Camera>(null)
    const [defaultSettings] = useState(() => initialCamera && cameraStopFor(initialCamera))
    const mapLoaded = useContext(MapLoadedContext)
    const mapSize = useContext(MapSizeContext)
    const holdFollow = defaultSettings != null && !mapLoaded
    useImperativeHandle(ref, () => ({
      resetNorth: (animated: boolean) =>
        inner.current?.setCamera({ heading: 0, animationDuration: animated ? 300 : 0 }),
      // The padding travels with the stop, so the camera ends holding exactly the padding it was
      // framed for.
      fitBounds: (ne, sw, padding, duration, pitch, heading) => {
        const size = mapSize.current
        if (!size) {
          logEvent('warn', 'map', 'fit dropped: map view not laid out yet')
          return
        }
        const { center, zoom } = fitCameraFor({ ne, sw, size, padding, heading, maxZoom: mapboxCapabilities.maxZoom })
        inner.current?.setCamera({
          centerCoordinate: center,
          zoomLevel: zoom,
          heading,
          padding: cameraPaddingFor(padding),
          pitch,
          animationDuration: duration,
        })
      },
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
        followPadding={followPadding && cameraPaddingFor(followPadding)}
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
// a transparent pixel. The image is drawn in the theme's `userPuck` and `userPuckRing`.
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
  tier, lines, connectors, connectorDashArray, color, lineWidth, colouredLines, casing,
  arrowImage, arrowSpacing, arrowSize, endpoints,
}: RouteOverlayProps) => {
  const belowLayerID = anchorLayerIdFor(tier)
  const arrowsLayer =
    arrowImage != null ? (
      <Mapbox.SymbolLayer
        key="arrows"
        id={`${tier}-arrows`}
        belowLayerID={belowLayerID}
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
        <Mapbox.ShapeSource id={`${tier}-slope-source`} shape={slopeShape}>
          {[
            casing && (
              <Mapbox.LineLayer
                key="slope-casing"
                id={`${tier}-slope-casing`}
                belowLayerID={belowLayerID}
                style={{ lineColor: TRAIL_CASING, lineWidth: lineWidth + 3, lineCap: 'round', lineJoin: 'round' }}
              />
            ),
            <Mapbox.LineLayer
              key="slope-line"
              id={`${tier}-slope-line`}
              belowLayerID={belowLayerID}
              style={{ lineColor: ['get', 'color'], lineWidth, lineCap: 'round', lineJoin: 'round' }}
            />,
            arrowsLayer,
          ].filter((el): el is React.ReactElement => !!el)}
        </Mapbox.ShapeSource>
      ) : (
        lines.length > 0 && (
          <Mapbox.ShapeSource id={`${tier}-line-source`} shape={multiLine(lines)}>
            {[
              casing && (
                <Mapbox.LineLayer
                  key="casing"
                  id={`${tier}-line-casing`}
                  belowLayerID={belowLayerID}
                  style={{ lineColor: TRAIL_CASING, lineWidth: lineWidth + 3, lineCap: 'round', lineJoin: 'round' }}
                />
              ),
              <Mapbox.LineLayer
                key="line"
                id={`${tier}-line`}
                belowLayerID={belowLayerID}
                style={{ lineColor: color, lineWidth, lineCap: 'round', lineJoin: 'round' }}
              />,
              arrowsLayer,
            ].filter((el): el is React.ReactElement => !!el)}
          </Mapbox.ShapeSource>
        )
      )}
      {connectors.length > 0 && (
        <Mapbox.ShapeSource id={`${tier}-connector-source`} shape={multiLine(connectors)}>
          <Mapbox.LineLayer
            id={`${tier}-connector`}
            belowLayerID={belowLayerID}
            style={{ lineColor: color, lineWidth, lineDasharray: connectorDashArray, lineCap: 'round' }}
          />
        </Mapbox.ShapeSource>
      )}
      {endpoints && (
        <Mapbox.ShapeSource
          id={`${tier}-endpoints-source`}
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
            id={`${tier}-endpoints`}
            belowLayerID={belowLayerID}
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
