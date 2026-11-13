import React, { type ComponentProps, type RefObject } from 'react'
import Mapbox from '@rnmapbox/maps'
import type { OverviewPin, OverviewProps } from '../../provider/types'
import { ROOM, TAG, TAG_IMAGE, TEARDROP } from './pinLayout'
import { OVERVIEW_PINS_ANCHOR } from './tiers'
import { OVERVIEW_SOURCES, PIN_LAYERS } from './overviewLayers'
import { pinsFile } from './overviewPinsFile'
import { useOverviewFile, type OverviewFileKind } from './useOverviewFile'
import { logEvent, toOneDecimal } from '../../../log'

// The teardrop's shapes are signed-distance images, tinted by the layer that draws them; its shadow,
// the tag's image and the room are plain images (D128). overview-pins.py draws all but the tag's.
const IMAGES: ComponentProps<typeof Mapbox.Images>['images'] = {
  'overview-pin-shadow': { image: require('./overview-pin-shadow.png'), scale: TEARDROP.scale },
  'overview-pin-outline': { image: require('./overview-pin-outline.png'), scale: TEARDROP.scale, sdf: true },
  'overview-pin-body': { image: require('./overview-pin-body.png'), scale: TEARDROP.scale, sdf: true },
  'overview-pin-body-left': { image: require('./overview-pin-body-left.png'), scale: TEARDROP.scale, sdf: true },
  'overview-pin-body-right': { image: require('./overview-pin-body-right.png'), scale: TEARDROP.scale, sdf: true },
  'overview-pin-centre': { image: require('./overview-pin-centre.png'), scale: TEARDROP.scale, sdf: true },
  'overview-pin-room': { image: require('./overview-pin-room.png'), scale: ROOM.scale },
  'overview-pin-tag': {
    image: require('./overview-pin-tag.png'),
    scale: TAG_IMAGE.scale,
    stretchX: TAG_IMAGE.stretchX,
    stretchY: TAG_IMAGE.stretchY,
    content: TAG_IMAGE.content,
  },
}

const CLUSTER_RADIUS = 10
const CLUSTER_BORDER = 2
const CLUSTER_TEXT_SIZE = 10

const PINS_FILE: OverviewFileKind<readonly OverviewPin[]> = {
  source: 'pins',
  build: pinsFile,
  onWritten: (pins, ms) => logEvent('info', 'map', 'overview pins written', { pins: pins.length, ms: toOneDecimal(ms) }),
}

// A layer filter and a data-driven style value share the SDK's expression type.
type Expression = NonNullable<ComponentProps<typeof Mapbox.SymbolLayer>['filter']>

const IS_CLUSTER: Expression = ['has', 'point_count']
const IS_PIN: Expression = ['!', IS_CLUSTER]
const pinOfKind = (kind: OverviewPin['kind']): Expression => ['all', IS_PIN, ['==', ['get', 'kind'], kind]]

// A completed trail shown with activities is split down through its tip: its body is the left half,
// in the trail colour, under the right half in the activity colour (D116).
const SPLIT: OverviewPin['kind'] = 'completedTrailWithActivities'
const BODY_IMAGE: Expression = ['match', ['get', 'kind'], SPLIT, 'overview-pin-body-left', 'overview-pin-body']

// A cluster is lit when it holds a pin that is not dimmed, so it dims with the rest (D117).
const CLUSTER_PROPERTIES = { lit: [['any', ['accumulated'], ['get', 'lit']], ['!', ['get', 'dimmed']]] }

type OverviewPinsProps = Pick<
  OverviewProps,
  'pins' | 'trailColor' | 'activityColor' | 'pinInkColor' | 'clusterColor' | 'tagTextColor' | 'pinFont' | 'cluster' | 'dimmedOpacity'
> & {
  // The pins source, which a cluster's pins are read from.
  sourceRef: RefObject<Mapbox.ShapeSource | null>
}

// The pins file and its one clustered source, so a cluster holds only the pins shown (D117, D138).
// Past the cap the source makes no finer tiles: the cap's tiles are drawn larger, their clusters with
// them, so pins still merged at the cap stay merged at every zoom.
//
// Layers, bottom to top, in the order they mount below the pins' anchor: the tag, under the teardrop
// it is tucked beside; the teardrop's shadow, outline, body or left half, right half and centre,
// always drawn and never in a tag's way; the cluster's disc and count, drawn over all and taking no
// room; then the teardrop's reserved place. Mapbox places symbols from the top layer down and keeps
// a tag only where nothing placed before it is, so every teardrop holds its place before any tag is
// placed, and the tags are placed by rank (D136).
export function OverviewPins({
  pins, trailColor, activityColor, pinInkColor, clusterColor, tagTextColor, pinFont, cluster, dimmedOpacity, sourceRef,
}: OverviewPinsProps) {
  const url = useOverviewFile(PINS_FILE, pins)
  if (url == null) return null
  const pinOpacity: Expression = ['case', ['get', 'dimmed'], dimmedOpacity, 1]
  const clusterOpacity: Expression = ['case', ['get', 'lit'], 1, dimmedOpacity]
  const teardrop = (image: string | Expression) => ({
    iconImage: image,
    iconAnchor: 'bottom' as const,
    iconOffset: TEARDROP.offset,
    iconAllowOverlap: true,
    iconIgnorePlacement: true,
    iconOpacity: pinOpacity,
  })
  return (
    <>
      <Mapbox.Images images={IMAGES} />
      <Mapbox.ShapeSource
        ref={sourceRef}
        id={OVERVIEW_SOURCES.pins}
        url={url}
        cluster
        clusterRadius={cluster.radius}
        clusterMaxZoomLevel={cluster.cap}
        maxZoomLevel={cluster.cap}
        clusterProperties={CLUSTER_PROPERTIES}
      >
        <Mapbox.SymbolLayer
          id={PIN_LAYERS.tag}
          belowLayerID={OVERVIEW_PINS_ANCHOR}
          filter={IS_PIN}
          style={{
            symbolSortKey: ['get', 'rank'],
            iconImage: 'overview-pin-tag',
            iconTextFit: 'both',
            iconTextFitPadding: TAG.iconTextFitPadding,
            iconAnchor: 'left',
            iconPadding: TAG.iconPadding,
            iconOpacity: pinOpacity,
            textField: ['get', 'tag'],
            textFont: [...pinFont],
            textSize: TAG.textSize,
            textColor: tagTextColor,
            textAnchor: 'left',
            textOffset: TAG.textOffset,
            textOpacity: pinOpacity,
          }}
        />
        <Mapbox.SymbolLayer
          id={PIN_LAYERS.shadow}
          belowLayerID={OVERVIEW_PINS_ANCHOR}
          filter={IS_PIN}
          style={teardrop('overview-pin-shadow')}
        />
        <Mapbox.SymbolLayer
          id={PIN_LAYERS.outline}
          belowLayerID={OVERVIEW_PINS_ANCHOR}
          filter={IS_PIN}
          style={{ ...teardrop('overview-pin-outline'), iconColor: pinInkColor }}
        />
        <Mapbox.SymbolLayer
          id={PIN_LAYERS.body}
          belowLayerID={OVERVIEW_PINS_ANCHOR}
          filter={IS_PIN}
          style={{ ...teardrop(BODY_IMAGE), iconColor: ['match', ['get', 'kind'], 'activity', activityColor, trailColor] }}
        />
        <Mapbox.SymbolLayer
          id={PIN_LAYERS.bodyRight}
          belowLayerID={OVERVIEW_PINS_ANCHOR}
          filter={pinOfKind(SPLIT)}
          style={{ ...teardrop('overview-pin-body-right'), iconColor: activityColor }}
        />
        <Mapbox.SymbolLayer
          id={PIN_LAYERS.centre}
          belowLayerID={OVERVIEW_PINS_ANCHOR}
          filter={pinOfKind('trail')}
          style={{ ...teardrop('overview-pin-centre'), iconColor: pinInkColor }}
        />
        <Mapbox.CircleLayer
          id={PIN_LAYERS.cluster}
          belowLayerID={OVERVIEW_PINS_ANCHOR}
          filter={IS_CLUSTER}
          style={{
            circleRadius: CLUSTER_RADIUS,
            circleColor: clusterColor,
            circleStrokeColor: pinInkColor,
            circleStrokeWidth: CLUSTER_BORDER,
            circleOpacity: clusterOpacity,
            circleStrokeOpacity: clusterOpacity,
          }}
        />
        <Mapbox.SymbolLayer
          id={PIN_LAYERS.clusterCount}
          belowLayerID={OVERVIEW_PINS_ANCHOR}
          filter={IS_CLUSTER}
          style={{
            textField: ['get', 'point_count_abbreviated'],
            textFont: [...pinFont],
            textSize: CLUSTER_TEXT_SIZE,
            textColor: pinInkColor,
            textAllowOverlap: true,
            textIgnorePlacement: true,
            textOpacity: clusterOpacity,
          }}
        />
        <Mapbox.SymbolLayer
          id={PIN_LAYERS.room}
          belowLayerID={OVERVIEW_PINS_ANCHOR}
          filter={IS_PIN}
          style={{
            iconImage: 'overview-pin-room',
            iconAnchor: 'bottom-right',
            iconOffset: ROOM.offset,
            iconPadding: ROOM.padding,
            iconAllowOverlap: true,
            iconIgnorePlacement: false,
          }}
        />
      </Mapbox.ShapeSource>
    </>
  )
}
