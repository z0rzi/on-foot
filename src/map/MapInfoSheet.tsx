import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, View, useWindowDimensions } from 'react-native'
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet'
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated'
import { useIsFocused, useRouter, type Href } from 'expo-router'
import { MapTokens } from '../theme/tokens'
import { useBackDismiss } from '../components/useBackDismiss'
import { CardFrame } from './CardFrame'
import { CardPipRow } from './CardPipRow'
import { GRAPH_BOTTOM_GAP, pipRow } from './sheetHeader'
import { SheetNavRow } from './SheetNavRow'
import { appliedOpenHeight, sheetSnapPoints } from './sheetSnapPoints'
import { SHEET_COLLAPSED as COLLAPSED, SHEET_OPEN as OPEN } from './sheetIndex'
import type { SheetRest } from './sheetRest'
import { useSheetOpen } from './useSheetOpen'
import { ElevationGraph } from '../elevation/ElevationGraph'
import type { RouteDisplay } from '../elevation/routeDisplay'
import type { MapMode } from './mapMode'

const DRAG_OFFSET: [number, number] = [-10, 10]

// The Map's one card, gorhom's sheet detached from the screen's edges, mounted in every state. Nothing
// shown and idle, it is the nav card: the nav row alone, which neither collapses nor opens. Otherwise
// it is the graph card: collapsed, the pip row, with the elevation graph under it when the state has a
// profile, shown at every height. Open it adds the state's details (scrolling past the cap) over the
// pinned nav row, which leads to the pushed screens. A change of state sends it to the new state's
// resting position; within a state it never moves on its own. The children are the details, and may
// be none.
export function MapInfoSheet({
  mode,
  rest,
  display,
  puck,
  animatedPosition,
  onIndexChange,
  children,
}: {
  mode: MapMode
  // The state's resting position.
  rest: SheetRest
  display: RouteDisplay | null
  // The graph's you-are-here position as a profile distance; null draws none.
  puck: number | null
  animatedPosition?: SharedValue<number>
  onIndexChange?: (index: number) => void
  children: ReactNode
}) {
  const router = useRouter()
  const focused = useIsFocused()
  const { height: windowHeight } = useWindowDimensions()
  const sheetRef = useRef<BottomSheet>(null)
  const animatedIndex = useSharedValue(COLLAPSED)
  // The one open value: everything below that depends on open reads it.
  const open = useSheetOpen(animatedIndex)
  const [measuredDetails, setMeasuredDetails] = useState(0)

  const navCard = rest.kind === 'nav'
  const pip = pipRow(display !== null)
  const measured = sheetSnapPoints({
    rest,
    detailsHeight: children ? measuredDetails : 0,
    windowHeight,
  })
  const [openHeight, setOpenHeight] = useState(measured.open)
  const nextOpenHeight = appliedOpenHeight(openHeight, measured.open, !open)
  if (nextOpenHeight !== openHeight) setOpenHeight(nextOpenHeight)
  const snapPoints = useMemo(() => [measured.rest, nextOpenHeight], [measured.rest, nextOpenHeight])

  const collapse = useCallback(() => sheetRef.current?.snapToIndex(COLLAPSED), [])
  const toggle = useCallback(() => sheetRef.current?.snapToIndex(open ? COLLAPSED : OPEN), [open])
  useBackDismiss(collapse, { open, focused })
  useEffect(() => {
    collapse()
  }, [mode, collapse])

  const navigate = useCallback(
    (href: Href) => {
      collapse()
      router.push(href)
    },
    [collapse, router],
  )

  // Details and nav row fade with the pull, so nothing of them shows while collapsed. The nav card is
  // the nav row, always shown.
  const revealStyle = useAnimatedStyle(() => ({
    opacity: interpolate(animatedIndex.value, [COLLAPSED, OPEN], [0, 1], Extrapolation.CLAMP),
  }))
  const hiddenWhileCollapsed = open ? 'auto' : 'no-hide-descendants'
  const navShown = navCard || open

  const footer = (
    <Animated.View
      style={navCard ? undefined : revealStyle}
      pointerEvents={navShown ? 'auto' : 'none'}
      importantForAccessibility={navShown ? 'auto' : 'no-hide-descendants'}
    >
      <SheetNavRow underDetails={!navCard} onNavigate={navigate} />
    </Animated.View>
  )

  return (
    <BottomSheet
      ref={sheetRef}
      index={COLLAPSED}
      snapPoints={snapPoints}
      // The snap points above are the whole contract; dynamic sizing (on by default in v5) would add
      // a content-derived one and let a content height change move the sheet on its own.
      enableDynamicSizing={false}
      enablePanDownToClose={false}
      // The snap points are the card's own heights above its bottom margin.
      detached
      bottomInset={rest.bottomInset}
      style={styles.sheet}
      // The nav card has no drag, and no pip to tap: its open snap point only keeps the snap points one
      // shape across states, and nothing reaches it.
      enableContentPanningGesture={!navCard}
      // The sheet claims vertical drags and leaves horizontal ones to the graph's scrub.
      activeOffsetY={DRAG_OFFSET}
      failOffsetX={DRAG_OFFSET}
      animatedPosition={animatedPosition}
      animatedIndex={animatedIndex}
      onChange={onIndexChange}
      handleComponent={null}
      backgroundComponent={null}
    >
      <CardFrame animatedIndex={animatedIndex} footer={footer}>
        {navCard ? null : (
          <>
            <CardPipRow height={pip.height} slop={pip.slop} open={open} onToggle={toggle} />
            {display ? (
              <View style={styles.graph}>
                <ElevationGraph display={display} puck={puck} coveredTop={pip.slop} />
              </View>
            ) : null}
            {/* The details end at the nav row's top edge wherever the pull leaves it, so nothing of them
                lies under the row. Inside, they keep the open card's layout, so a drag never lays them
                out again. */}
            <View style={[styles.detailsClip, { top: rest.height, bottom: rest.navRowHeight }]}>
              <Animated.View
                style={[{ height: nextOpenHeight - rest.height }, revealStyle]}
                importantForAccessibility={hiddenWhileCollapsed}
              >
                <BottomSheetScrollView contentContainerStyle={{ paddingBottom: rest.navRowHeight }}>
                  {children ? (
                    <View style={styles.details} onLayout={(e) => setMeasuredDetails(e.nativeEvent.layout.height)}>
                      {children}
                    </View>
                  ) : null}
                </BottomSheetScrollView>
              </Animated.View>
            </View>
          </>
        )}
      </CardFrame>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  sheet: { marginHorizontal: MapTokens.overlayPadding },
  graph: { paddingHorizontal: 16, paddingBottom: GRAPH_BOTTOM_GAP },
  detailsClip: { position: 'absolute', left: 0, right: 0, overflow: 'hidden' },
  details: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
})
