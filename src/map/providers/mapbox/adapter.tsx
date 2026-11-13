import React, { createContext, forwardRef, useContext, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { StyleSheet, View as RNView } from 'react-native'
import Mapbox, { type MapState } from '@rnmapbox/maps'
import type {
  MapProvider, MapViewProps, CameraProps, TerrainProps, CameraController, RouteOverlayProps,
  ScrubMarkerProps, UserPuckProps, OverviewItem, OverviewProps,
} from '../../provider/types'
import { OVERVIEW_LINE_SLOTS, type OverviewLineSlot, type RouteLayer } from '../../provider/stacking'
import { mapboxCapabilities } from './capabilities'
import { mapboxOfflineController } from './offline'
import { trackingModeFor } from './followMode'
import { cameraPaddingFor, cameraStopFor, fitCameraFor, framingFromMapState, type ViewSize } from './camera'
import { TERRAIN_DEM } from './styles'
import { SLOT_ANCHORS, anchorLayerIdForOverviewSlot, anchorLayerIdForSlot } from './tiers'
import { linesFile, linesFileCounts } from './overviewLinesFile'
import { overviewLineFilters, type OverviewLineFilter } from './overviewLineFilters'
import { useOverviewFile, type OverviewFileKind } from './useOverviewFile'
import { OverviewPins } from './overviewPins'
import { OVERVIEW_SOURCES, overviewLineLayerId } from './overviewLayers'
import { MapPressContext, type MapPressListener } from './mapPress'
import { useOverviewPress } from './useOverviewPress'
import { MAPBOX_ACCESS_TOKEN } from './token'
import { logEvent, toOneDecimal } from '../../../log'

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
  const map = useRef<Mapbox.MapView>(null)
  const [pressListeners] = useState(() => new Set<MapPressListener>())
  return (
    <RNView
      style={style}
      onLayout={(e) => {
        size.current = { width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height }
      }}
    >
      <Mapbox.MapView
        ref={map}
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
        onPress={(press) => {
          const view = map.current
          if (view) pressListeners.forEach((listener) => listener(press, view))
        }}
        onDidFinishLoadingMap={() => {
          setLoaded(true)
          onMapLoaded?.()
        }}
      >
        {/* rnmapbox adds a layer on top of the stack as it mounts once the style has loaded,
            unless it is given an aboveLayerID, belowLayerID or layerIndex; child order only
            orders the layers queued before the style loads. So the overview's lines, the route
            tiers, and the layers of an overlay inside its tier, are held by one invisible anchor
            layer per slot (an overview line layer, or a tier and kind of layer), mounted in
            stacking order as the map's first children, and every overview and route overlay layer
            is inserted below its slot's anchor (belowLayerID, which waits for
            the anchor if it is not on the map yet). On a style reload rnmapbox re-adds the map's
            children in child order, so the anchors come back first, in order. With terrain on,
            Mapbox draws the symbol and circle layers (arrows, endpoints) above every line layer,
            whatever their place in the style, so they show above the lines of both tiers. */}
        {SLOT_ANCHORS.map((id) => (
          <Mapbox.BackgroundLayer key={id} id={id} style={{ visibility: 'none' }} />
        ))}
        <MapLoadedContext.Provider value={loaded}>
          <MapSizeContext.Provider value={size}>
            <MapPressContext.Provider value={pressListeners}>{children}</MapPressContext.Provider>
          </MapSizeContext.Provider>
        </MapLoadedContext.Provider>
      </Mapbox.MapView>
    </RNView>
  )
}

// The camera is driven declaratively (follow props / pitch) — see MapCanvas. Two imperative
// affordances remain, both only ever called when follow is off, so the rnmapbox "imperative move is
// a no-op while following" trap does not apply: resetNorth, a one-shot rotate to bearing 0, and
// fitBounds, which frames a trail, an activity or a cluster's starts. The port describes both (`src/map/provider/types.ts`). Pull out
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
      fitBounds: (ne, sw, padding, duration, pitch, heading, maxZoom) => {
        const size = mapSize.current
        if (!size) {
          logEvent('warn', 'map', 'fit dropped: map view not laid out yet')
          return
        }
        const { center, zoom } = fitCameraFor({
          ne,
          sw,
          size,
          padding,
          heading,
          maxZoom: Math.min(maxZoom ?? mapboxCapabilities.maxZoom, mapboxCapabilities.maxZoom),
        })
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
  const below = (layer: RouteLayer) => anchorLayerIdForSlot(tier, layer)
  const arrowsLayer =
    arrowImage != null ? (
      <Mapbox.SymbolLayer
        key="arrows"
        id={`${tier}-arrows`}
        belowLayerID={below('arrows')}
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
                belowLayerID={below('casing')}
                style={{ lineColor: TRAIL_CASING, lineWidth: lineWidth + 3, lineCap: 'round', lineJoin: 'round' }}
              />
            ),
            <Mapbox.LineLayer
              key="slope-line"
              id={`${tier}-slope-line`}
              belowLayerID={below('line')}
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
                  belowLayerID={below('casing')}
                  style={{ lineColor: TRAIL_CASING, lineWidth: lineWidth + 3, lineCap: 'round', lineJoin: 'round' }}
                />
              ),
              <Mapbox.LineLayer
                key="line"
                id={`${tier}-line`}
                belowLayerID={below('line')}
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
            belowLayerID={below('connectors')}
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
            belowLayerID={below('endpoints')}
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

const LINES_FILE: OverviewFileKind<readonly OverviewItem[]> = {
  source: 'lines',
  build: linesFile,
  onWritten: (items, ms) => logEvent('info', 'map', 'overview loaded', { ...linesFileCounts(items), ms: toOneDecimal(ms) }),
}

type OverviewLinesProps = Pick<OverviewProps, 'trailColor' | 'activityColor' | 'lineWidth' | 'lineZoom'> & {
  slot: OverviewLineSlot
  filter: OverviewLineFilter
  opacity: number
}

// One of the overview's line layers, in its slot, at a constant opacity faded in by zoom only. It
// names its source itself: a source hands its id to its direct children only, which this wrapper is.
const OverviewLines = ({ slot, filter, opacity, trailColor, activityColor, lineWidth, lineZoom }: OverviewLinesProps) => (
  <Mapbox.LineLayer
    id={overviewLineLayerId(slot)}
    sourceID={OVERVIEW_SOURCES.lines}
    belowLayerID={anchorLayerIdForOverviewSlot(slot)}
    minZoomLevel={lineZoom.from}
    filter={filter}
    style={{
      lineColor: ['match', ['get', 'class'], 'trail', trailColor, activityColor],
      lineWidth,
      lineOpacity: ['interpolate', ['linear'], ['zoom'], lineZoom.from, 0, lineZoom.to, opacity],
      lineCap: 'round',
      lineJoin: 'round',
    }}
  />
)

// The overview reaches the map as a file the engine reads on its own threads (D138): the source
// only takes the file's short url, so a re-render costs nothing, and the focus restyles the layers
// without touching the file. The lines are drawn by three layers, the dimmed rest, the rest at full
// strength and the family, each holding its lines by a filter (D127). Lines are hidden by those
// filters, never by an opacity per line, which would leave them pressable; below the zoom fade's
// start they are not laid out at all (D107). The pins have a file and a source of their own, with no
// line in it: the lines live in a source with no text, so a font that fails offline takes no line
// with it (D133).
const Overview = ({ items, focus, lineWidth, lineZoom, pressTolerance, onPress, ...forPins }: OverviewProps) => {
  const linesUrl = useOverviewFile(LINES_FILE, items)
  const pinsSource = useRef<Mapbox.ShapeSource>(null)
  useOverviewPress(pinsSource, pressTolerance, onPress)
  const filters = useMemo(() => overviewLineFilters(focus), [focus])
  const { trailColor, activityColor, dimmedOpacity } = forPins
  return (
    <>
      {linesUrl != null && (
        <Mapbox.ShapeSource id={OVERVIEW_SOURCES.lines} url={linesUrl}>
          {OVERVIEW_LINE_SLOTS.map((slot) => (
            <OverviewLines
              key={slot}
              slot={slot}
              filter={filters[slot]}
              opacity={slot === 'dimmed' ? dimmedOpacity : 1}
              trailColor={trailColor}
              activityColor={activityColor}
              lineWidth={lineWidth}
              lineZoom={lineZoom}
            />
          ))}
        </Mapbox.ShapeSource>
      )}
      <OverviewPins {...forPins} sourceRef={pinsSource} />
    </>
  )
}

export const mapboxProvider: MapProvider = {
  capabilities: mapboxCapabilities,
  components: { View, Camera, Terrain, UserPuck, RouteOverlay, ScrubMarker, Overview },
  offline: mapboxOfflineController,
}
