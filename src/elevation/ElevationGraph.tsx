import { useMemo, useState } from 'react'
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native'
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Svg, { Defs, LinearGradient, Line, Path, Stop } from 'react-native-svg'
import { useTheme } from '../theme/useTheme'
import { MapTokens } from '../theme/tokens'
import { usePreferencesStore } from '../settings/preferencesStore'
import { formatDistance, formatElevation } from '../data/geo/metrics'
import { ElevationProfile, GradeBand, sampleAt } from './profile'
import { smoothProfile, slopeBands } from './slope'
import { buildBandAreas, buildBandLines } from './svg'
import { slopeBandColour } from './slopeColour'
import { useScrubStore } from './scrubStore'

const PLOT_HEIGHT = 62
const LABEL_ROW = 16
export const GRAPH_HEIGHT = PLOT_HEIGHT + LABEL_ROW

const BAND_KEYS: GradeBand[] = ['steep', 'rough', 'uphill', 'flat', 'downhill']

// The graph overlays the map, which does not follow the app's light/dark theme, so its line and
// halo are theme-independent: a dark line on a light halo reads over any map style or sheet.
const GRAPH_LINE = '#1C1B1F'
const GRAPH_HALO = '#FFFFFF'

interface Cursor { x: number; label: string }

// Non-colour channel (accessibility): steeper UPHILL → thicker, higher-contrast line.
const lineWidth = (band: GradeBand): number =>
  band === 'steep' ? 4.5
  : band === 'rough' ? 3.5
  : band === 'uphill' ? 2.5
  : 1 // downhill + flat
const lineContrast = (band: GradeBand): number =>
  band === 'steep' ? 1
  : band === 'rough' ? 0.9
  : band === 'uphill' ? 0.7
  : band === 'downhill' ? 0.4
  : 0.35

export function ElevationGraph({
  profile,
  placement,
  animatedBottom,
}: {
  profile: ElevationProfile
  placement: 'floating' | 'inSheet'
  animatedBottom?: SharedValue<number>
}) {
  const c = useTheme()
  const insets = useSafeAreaInsets()
  const setPoint = useScrubStore((s) => s.setPoint)
  const smoothing = usePreferencesStore((s) => s.elevationSmoothingMeters)
  const [width, setWidth] = useState(0)
  const [cursor, setCursor] = useState<Cursor | null>(null)
  const floating = placement === 'floating'

  const smoothed = useMemo(() => smoothProfile(profile, smoothing), [profile, smoothing])
  const bands = useMemo(() => slopeBands(smoothed, smoothing), [smoothed, smoothing])
  const areas = useMemo(
    () => (width === 0 ? [] : buildBandAreas(profile, bands, { width, height: PLOT_HEIGHT })),
    [profile, bands, width],
  )
  const bandLines = useMemo(
    () => (width === 0 ? [] : buildBandLines(profile, bands, { width, height: PLOT_HEIGHT })),
    [profile, bands, width],
  )

  // Fill colour per band. Floating overlays the map, so flat is a theme-independent light grey;
  // in-sheet flat uses the sheet colour so it blends into the (theme-aware) sheet.
  const fillColour = (band: GradeBand): string =>
    band === 'flat' && !floating ? c.panelBackground : slopeBandColour(band, c)

  const pan = useMemo(
    () =>
      Gesture.Pan()
        // Only claim horizontal drags so a vertical drag still moves the bottom sheet.
        .activeOffsetX([-10, 10])
        .onBegin((e) => scrubTo(e.x))
        .onUpdate((e) => scrubTo(e.x))
        .onFinalize(() => {
          setCursor(null)
          setPoint(null)
        })
        .runOnJS(true),
    [width, profile, smoothed],
  )

  function scrubTo(px: number) {
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
  }

  const floatingStyle = useAnimatedStyle(() => ({
    bottom: animatedBottom ? animatedBottom.value : insets.bottom + MapTokens.overlayPadding,
  }))

  const content = (
    <>
      <View style={styles.labelRow}>
        {cursor && (
          <View style={styles.tooltipPill}>
            <Text style={styles.tooltipText}>{cursor.label}</Text>
          </View>
        )}
      </View>
      <GestureDetector gesture={pan}>
        <View style={styles.plot} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
          {width > 0 && (
            <Svg width={width} height={PLOT_HEIGHT}>
              {floating && (
                <Defs>
                  {BAND_KEYS.map((b) => (
                    <LinearGradient key={`grad-${b}`} id={`grad-${b}`} x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0" stopColor={fillColour(b)} stopOpacity={1} />
                      <Stop offset="0.6" stopColor={fillColour(b)} stopOpacity={0.45} />
                      <Stop offset="1" stopColor={fillColour(b)} stopOpacity={0} />
                    </LinearGradient>
                  ))}
                </Defs>
              )}
              {areas.map((a, i) =>
                floating ? (
                  <Path key={`area-${i}`} d={a.d} fill={`url(#grad-${a.band})`} />
                ) : (
                  <Path key={`area-${i}`} d={a.d} fill={fillColour(a.band)} fillOpacity={0.7} />
                ),
              )}
              {floating &&
                bandLines.map((l, i) => (
                  <Path
                    key={`halo-${i}`}
                    d={l.d}
                    stroke={GRAPH_HALO}
                    strokeOpacity={0.6}
                    strokeWidth={lineWidth(l.band) + 2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                ))}
              {bandLines.map((l, i) => (
                <Path
                  key={`line-${i}`}
                  d={l.d}
                  stroke={floating ? GRAPH_LINE : c.onSurface}
                  strokeOpacity={lineContrast(l.band)}
                  strokeWidth={lineWidth(l.band)}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              ))}
              {cursor && (
                <Line x1={cursor.x} y1={0} x2={cursor.x} y2={PLOT_HEIGHT} stroke={c.controlAccent} strokeWidth={1.5} />
              )}
            </Svg>
          )}
        </View>
      </GestureDetector>
    </>
  )

  return floating ? (
    <Animated.View style={[styles.floating, floatingStyle]}>{content}</Animated.View>
  ) : (
    <View style={styles.inSheet}>{content}</View>
  )
}

const styles = StyleSheet.create({
  floating: {
    position: 'absolute',
    left: MapTokens.overlayPadding,
    right: MapTokens.overlayPadding,
    height: GRAPH_HEIGHT,
  },
  inSheet: { height: GRAPH_HEIGHT },
  labelRow: { height: LABEL_ROW, justifyContent: 'center', alignItems: 'flex-start' },
  tooltipPill: { backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  tooltipText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  plot: { height: PLOT_HEIGHT },
})
