import { useCallback, useMemo, useState } from 'react'
import { LayoutChangeEvent, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Svg, { Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg'
import { useTheme } from '../theme/useTheme'
import { formatDistance, formatElevation } from '../format/units'
import { sampleAt } from './profile'
import { areaPaths, buildBandTops, linePaths, projectPoint } from './svg'
import { bandLineContrast, bandLineWidth } from './bandStyle'
import { graphLook } from './graphLook'
import { elevationAxis } from './elevationAxis'
import { axisLayout } from './axisLayout'
import { useScrubStore } from './scrubStore'
import type { RouteDisplay } from './routeDisplay'
import { GRAPH_HEIGHT, scrubShowsOnTouch } from './graphGeometry'

const PUCK_SIZE = 12
const PUCK_RING = 2
const AXIS_GRID_OPACITY = 0.25
const AXIS_LABEL_SIZE = 11
const AXIS_LABEL_INSET = 4

interface Cursor { x: number; label: string }

// The elevation graph, the card's header under the pip row, in its draggable content, as wide as the
// card's content: the y-axis's labels sit in the plot at its left edge, behind the bands and the line.
// A horizontal drag on the plot scrubs, its tooltip floating over the plot's top; a vertical one is
// left to the sheet, whose grab area the graph is part of.
export function ElevationGraph({
  display,
  puck = null,
  coveredTop,
}: {
  display: RouteDisplay
  // The you-are-here position as a profile distance; null draws none.
  puck?: number | null
  // The band at the plot's top under the touch target of a control above it.
  coveredTop: number
}) {
  const { profile, smoothed, bands } = display
  const c = useTheme()
  const look = graphLook(c)
  const setPoint = useScrubStore((s) => s.setPoint)
  const [width, setWidth] = useState(0)
  const [cursor, setCursor] = useState<Cursor | null>(null)

  const labelSize = AXIS_LABEL_SIZE * useWindowDimensions().fontScale
  const axis = useMemo(
    () => axisLayout(elevationAxis(profile.minEle, profile.maxEle), labelSize, GRAPH_HEIGHT),
    [profile, labelSize],
  )
  const gridlines = axis.labels
  const scale = useMemo(() => ({ width, y: axis.y }), [width, axis])

  // Both path sets are built from the same projected tops, so the samples are resolved and
  // projected once per layout rather than once per path set.
  const tops = useMemo(
    () => (scale.width === 0 ? [] : buildBandTops(profile, bands, scale)),
    [profile, bands, scale],
  )
  const areas = useMemo(() => areaPaths(tops, GRAPH_HEIGHT), [tops])
  const bandLines = useMemo(() => linePaths(tops), [tops])
  // Drawn over the plot rather than in its Svg, so at an edge the puck reaches whole into the card's margin.
  const puckAt = useMemo(
    () => (puck === null || scale.width === 0 ? null : projectPoint(puck, profile, scale)),
    [puck, profile, scale],
  )

  const scrubTo = useCallback(
    (px: number) => {
      if (width === 0) return
      const x = Math.max(0, Math.min(px, width))
      const distance = (x / width) * profile.totalDistance
      const s = sampleAt(profile, distance)
      const grade = Math.round(sampleAt(smoothed, distance).grade)
      setCursor({
        x,
        label: `${formatElevation(s.ele)} · ${formatDistance(distance)} · ${grade > 0 ? '+' : ''}${grade}%`,
      })
      setPoint({ lat: s.lat, lng: s.lng })
    },
    [width, profile, smoothed, setPoint],
  )

  const pan = useMemo(
    () =>
      Gesture.Pan()
        // Claims horizontal drags only; a vertical one fails it and moves the sheet instead.
        .activeOffsetX([-10, 10])
        .failOffsetY([-10, 10])
        .onBegin((e) => {
          if (scrubShowsOnTouch(e.y, coveredTop)) scrubTo(e.x)
        })
        .onStart((e) => scrubTo(e.x))
        .onUpdate((e) => scrubTo(e.x))
        .onFinalize(() => {
          setCursor(null)
          setPoint(null)
        })
        .runOnJS(true),
    [scrubTo, setPoint, coveredTop],
  )

  return (
    <View style={styles.graph}>
      <GestureDetector gesture={pan}>
        <View style={styles.plot} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
          {width > 0 && (
            <Svg width={width} height={GRAPH_HEIGHT}>
              {gridlines.map((g) => (
                <Line
                  key={`grid-${g.label}`}
                  x1={0}
                  y1={g.y}
                  x2={width}
                  y2={g.y}
                  stroke={look.axis}
                  strokeOpacity={AXIS_GRID_OPACITY}
                  strokeWidth={1}
                />
              ))}
              {gridlines.map((g) => (
                <SvgText key={`label-${g.label}`} x={AXIS_LABEL_INSET} y={g.baseline} fontSize={labelSize} fill={look.axis}>
                  {g.label}
                </SvgText>
              ))}
              <Defs>
                {areas.map((a, i) => (
                  <LinearGradient key={`fade-${i}`} id={`fade-${i}`} x1="0" y1="0" x2="0" y2="1">
                    {look.fade.map((stop) => (
                      <Stop key={stop.offset} offset={stop.offset} stopColor={look.fill(a.band)} stopOpacity={stop.opacity} />
                    ))}
                  </LinearGradient>
                ))}
              </Defs>
              {areas.map((a, i) => (
                <Path key={`area-${i}`} d={a.d} fill={`url(#fade-${i})`} />
              ))}
              {bandLines.map((l, i) => (
                <Path
                  key={`line-${i}`}
                  d={l.d}
                  stroke={look.line}
                  strokeOpacity={bandLineContrast(l.band)}
                  strokeWidth={bandLineWidth(l.band)}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              ))}
              {cursor && (
                <Line x1={cursor.x} y1={0} x2={cursor.x} y2={GRAPH_HEIGHT} stroke={c.controlAccent} strokeWidth={1.5} />
              )}
            </Svg>
          )}
          {puckAt && (
            <View
              style={[
                styles.puck,
                {
                  left: puckAt.x - PUCK_SIZE / 2,
                  top: puckAt.y - PUCK_SIZE / 2,
                  backgroundColor: c.userPuck,
                  borderColor: c.userPuckRing,
                },
              ]}
              pointerEvents="none"
            />
          )}
          {cursor && (
            <View style={styles.tooltipPill} pointerEvents="none">
              <Text style={styles.tooltipText}>{cursor.label}</Text>
            </View>
          )}
        </View>
      </GestureDetector>
    </View>
  )
}

const styles = StyleSheet.create({
  graph: { height: GRAPH_HEIGHT },
  puck: {
    position: 'absolute',
    width: PUCK_SIZE,
    height: PUCK_SIZE,
    borderRadius: PUCK_SIZE / 2,
    borderWidth: PUCK_RING,
  },
  tooltipPill: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  tooltipText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  plot: { flex: 1, height: GRAPH_HEIGHT },
})
