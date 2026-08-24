# Trail Info Sheet Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the trail's floating info banner with the same draggable bottom sheet the activity view uses, extracting the shared chrome so neither sheet re-implements it.

**Architecture:** Extract three shared units (`MapInfoSheet` chrome, `MetricsGrid` presentational, `MapModeChip` top pill) and build both the refactored `ActivityInfoSheet` and the new `TrailInfoSheet` on top of them. MapScreen becomes symmetric across trail/activity selection: both render a sheet + a mode pill, and both drive the right-side controls (and, for trails, the Record button) off the sheet's live top edge via `animatedPosition`.

**Tech Stack:** Expo SDK 57, React Native, TypeScript, `@gorhom/bottom-sheet`, `react-native-reanimated`.

## Global Constraints

- **Map-provider seam is inviolable:** no `@rnmapbox/maps` (or any map SDK) import outside `src/map/providers/`. None of these files touch the SDK — keep it that way.
- **Comments describe current state only, sparingly.** No change-narrating comments (AGENTS.md).
- **Pure logic is TDD'd; rendering is device-verified.** This change is all presentation/wiring over existing data — there is **no new pure logic**, so **no new Jest specs**. The trail/activity branching already lives in `mapMode` (already tested). Verification per task = `npx tsc --noEmit` clean + full existing `npx jest` green + seam check clean.
- **Keep units small and single-purpose.**
- **Snap points are `['16%', '55%']`** for both sheets, defined once in `MapInfoSheet`.
- **Pill copy:** `Viewing trail · <name>` and `Viewing activity · <name>`.
- **Record (Play) button stays visible in trail mode** and its bottom offset rides the sheet, exactly like `MapControls`.

**Seam check command (run where the plan says "seam check"):**
```bash
grep -rn "@rnmapbox/maps" src --include=*.tsx --include=*.ts | grep -v "src/map/providers/" || echo "SEAM CLEAN"
```
Expected: `SEAM CLEAN`.

---

### Task 1: Shared `MapInfoSheet` + `MetricsGrid`, refactor `ActivityInfoSheet` onto them

Create the two shared presentational units and immediately prove them by rebuilding the existing activity sheet on top — **zero behaviour change**. A reviewer verifies the refactored activity sheet renders identically to the old one.

**Files:**
- Create: `src/map/MapInfoSheet.tsx`
- Create: `src/map/MetricsGrid.tsx`
- Modify: `src/map/ActivityInfoSheet.tsx` (rebuild on the two new units)

**Interfaces:**
- Produces:
  - `MapInfoSheet({ animatedPosition?: SharedValue<number>; children: ReactNode })` — owns the `BottomSheet` chrome; renders children in a themed `BottomSheetView`.
  - `MetricsGrid({ items: { label: string; value: string }[] })` — the themed metrics row.
- Consumes: existing theme (`useTheme`), `@gorhom/bottom-sheet`, `react-native-reanimated` `SharedValue`.

- [ ] **Step 1: Create `src/map/MapInfoSheet.tsx`**

```tsx
import { ReactNode } from 'react'
import { StyleSheet } from 'react-native'
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet'
import type { SharedValue } from 'react-native-reanimated'
import { useTheme } from '../theme/useTheme'

const SNAP_POINTS = ['16%', '55%']

export function MapInfoSheet({
  animatedPosition,
  children,
}: {
  animatedPosition?: SharedValue<number>
  children: ReactNode
}) {
  const c = useTheme()
  return (
    <BottomSheet
      index={0}
      snapPoints={SNAP_POINTS}
      enablePanDownToClose={false}
      animatedPosition={animatedPosition}
      backgroundStyle={{ backgroundColor: c.panelBackground }}
      handleIndicatorStyle={{ backgroundColor: c.onSurfaceVariant }}
    >
      <BottomSheetView style={styles.content}>{children}</BottomSheetView>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
})
```

- [ ] **Step 2: Create `src/map/MetricsGrid.tsx`**

```tsx
import { StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../theme/useTheme'

export function MetricsGrid({ items }: { items: { label: string; value: string }[] }) {
  const c = useTheme()
  return (
    <View style={[styles.metrics, { backgroundColor: c.surface }]}>
      {items.map((item) => (
        <View key={item.label} style={styles.metricItem}>
          <Text style={[styles.metricValue, { color: c.onSurface }]}>{item.value}</Text>
          <Text style={[styles.metricLabel, { color: c.onSurfaceVariant }]}>{item.label}</Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  metrics: { flexDirection: 'row', justifyContent: 'space-evenly', borderRadius: 12, padding: 12 },
  metricItem: { alignItems: 'center' },
  metricValue: { fontSize: 15, fontWeight: '700' },
  metricLabel: { fontSize: 11, marginTop: 2 },
})
```

- [ ] **Step 3: Rewrite `src/map/ActivityInfoSheet.tsx` onto the shared units**

Replace the whole file with:

```tsx
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { SharedValue } from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { Activity } from '../data/activities/types'
import { Trail, trailsRepository } from '../data/trails'
import { useTheme } from '../theme/useTheme'
import { EffortBadge } from '../activities/EffortBadge'
import { formatActivityDate, formatActivitySummary, formatDuration } from '../activities/format'
import { formatDistance, formatElevation } from '../data/trails/gpx/metrics'
import { MapInfoSheet } from './MapInfoSheet'
import { MetricsGrid } from './MetricsGrid'

export function ActivityInfoSheet({
  activity,
  onViewLinkedTrail,
  animatedPosition,
}: {
  activity: Activity
  onViewLinkedTrail: (trailId: number) => void
  animatedPosition?: SharedValue<number>
}) {
  const c = useTheme()
  const [linkedTrail, setLinkedTrail] = useState<Trail | null>(null)

  useEffect(() => {
    const id = activity.linkedTrailId
    if (id == null) {
      setLinkedTrail(null)
      return
    }
    let active = true
    trailsRepository.getTrail(id).then((t) => {
      if (active) setLinkedTrail(t)
    })
    return () => {
      active = false
    }
  }, [activity.linkedTrailId])

  return (
    <MapInfoSheet animatedPosition={animatedPosition}>
      <Text style={[styles.name, { color: c.panelContent }]} numberOfLines={1}>{activity.name}</Text>
      <View style={styles.summaryRow}>
        <EffortBadge effort={activity.effort} />
        <Text style={[styles.summary, { color: c.onSurfaceVariant }]}>
          {formatActivitySummary(activity.metrics)}  ·  {formatActivityDate(activity.startedAt)}
        </Text>
      </View>

      <MetricsGrid
        items={[
          { label: 'Distance', value: formatDistance(activity.metrics.distanceMeters) },
          { label: 'Duration', value: formatDuration(activity.metrics.durationSeconds) },
          { label: 'Elev. Gain', value: formatElevation(activity.metrics.elevationGainMeters) },
          { label: 'Elev. Loss', value: formatElevation(activity.metrics.elevationLossMeters) },
        ]}
      />

      {activity.comments != null && (
        <Text style={[styles.comments, { color: c.panelContent }]}>{activity.comments}</Text>
      )}

      {linkedTrail && (
        <Pressable
          accessibilityLabel="View linked trail"
          onPress={() => onViewLinkedTrail(linkedTrail.id)}
          style={[styles.linkBtn, { borderColor: c.trailLine }]}
        >
          <Ionicons name="trail-sign-outline" size={18} color={c.trailLine} />
          <Text style={[styles.linkLabel, { color: c.trailLine }]} numberOfLines={1}>
            View linked trail: {linkedTrail.name}
          </Text>
        </Pressable>
      )}
    </MapInfoSheet>
  )
}

const styles = StyleSheet.create({
  name: { fontSize: 18, fontWeight: '700' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summary: { fontSize: 13, flexShrink: 1 },
  comments: { fontSize: 14, lineHeight: 20 },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 },
  linkLabel: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
})
```

The `BottomSheet`/`BottomSheetView` import, `useMemo`, `snapPoints`, the old `content`/`metrics`/`metricItem`/`metricValue`/`metricLabel` styles, and the standalone `Metric` component are all gone — the chrome and grid now live in the shared units.

- [ ] **Step 4: Verify types and tests**

Run: `npx tsc --noEmit`
Expected: clean.

Run: `npx jest`
Expected: all existing suites green (no new specs added).

Run the seam check command from Global Constraints.
Expected: `SEAM CLEAN`.

- [ ] **Step 5: Commit**

```bash
git add src/map/MapInfoSheet.tsx src/map/MetricsGrid.tsx src/map/ActivityInfoSheet.tsx
git commit -m "refactor: extract MapInfoSheet + MetricsGrid from the activity sheet"
```

---

### Task 2: Generalize `ActivityModeChip` → `MapModeChip`

Rename the top-pill component to a mode-neutral one and rewire the activity usage in MapScreen. **Zero behaviour change** for activities.

**Files:**
- Create: `src/map/MapModeChip.tsx`
- Delete: `src/map/ActivityModeChip.tsx`
- Modify: `src/map/MapScreen.tsx` (swap the import + activity-mode usage; add `useTheme`)

**Interfaces:**
- Produces: `MapModeChip({ label: string; icon: keyof typeof Ionicons.glyphMap; color: string; onExit: () => void })`.
- Consumes: `MapTokens`, `useSafeAreaInsets`.

- [ ] **Step 1: Create `src/map/MapModeChip.tsx`**

```tsx
import { Ionicons } from '@expo/vector-icons'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MapTokens } from '../theme/tokens'

export function MapModeChip({
  label,
  icon,
  color,
  onExit,
}: {
  label: string
  icon: keyof typeof Ionicons.glyphMap
  color: string
  onExit: () => void
}) {
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.wrap, { top: insets.top + MapTokens.controlsSpacing }]} pointerEvents="box-none">
      <View style={[styles.chip, { backgroundColor: color }]}>
        <Ionicons name={icon} size={16} color="#FFFFFF" />
        <Text style={styles.label} numberOfLines={1}>{label}</Text>
        <Pressable accessibilityLabel="Exit view" onPress={onExit} hitSlop={8}>
          <Ionicons name="close" size={18} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: 16 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '100%',
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, elevation: 6,
  },
  label: { color: '#FFFFFF', fontWeight: '700', fontSize: 14, flexShrink: 1 },
})
```

- [ ] **Step 2: Delete the old file**

```bash
git rm src/map/ActivityModeChip.tsx
```

- [ ] **Step 3: Rewire MapScreen's activity chip**

In `src/map/MapScreen.tsx`:

Replace the import line
```tsx
import { ActivityModeChip } from './ActivityModeChip'
```
with
```tsx
import { MapModeChip } from './MapModeChip'
```

Add a theme import alongside the other imports:
```tsx
import { useTheme } from '../theme/useTheme'
```

Inside `MapScreen`, add near the other hooks (e.g. right after `useLocationPermission()`):
```tsx
  const c = useTheme()
```

Replace the activity chip usage
```tsx
              <ActivityModeChip activity={activity} onExit={clearSelection} />
```
with
```tsx
              <MapModeChip
                icon="walk"
                color={c.activityLine}
                label={`Viewing activity · ${activity.name}`}
                onExit={clearSelection}
              />
```

- [ ] **Step 4: Verify types and tests**

Run: `npx tsc --noEmit` → clean.
Run: `npx jest` → all existing suites green.
Run the seam check → `SEAM CLEAN`.

- [ ] **Step 5: Commit**

```bash
git add src/map/MapModeChip.tsx src/map/MapScreen.tsx
git commit -m "refactor: generalize the activity pill into a reusable MapModeChip"
```

---

### Task 3: `TrailInfoSheet` + Record button rides the sheet + MapScreen trail rewrite

The feature switch. Add `animatedBottom` to `RecordButton`, build `TrailInfoSheet`, rewrite MapScreen's trail branch to render the sheet + pill with sheet-riding Record and controls, and delete the old `TrailInfoCard`. This is one atomic behaviour change — splitting it leaves a half-broken trail mode.

**Files:**
- Modify: `src/map/RecordButton.tsx` (add `animatedBottom`)
- Create: `src/trails/TrailInfoSheet.tsx`
- Modify: `src/map/MapScreen.tsx` (trail branch, Record/controls wiring, remove `cardHeight`/`trailLift`)
- Delete: `src/trails/TrailInfoCard.tsx`

**Interfaces:**
- Consumes: `MapInfoSheet`, `MetricsGrid` (Task 1); `MapModeChip` (Task 2); `controlsAnimatedBottom: SharedValue<number>` (already in MapScreen).
- Produces:
  - `RecordButton({ extraBottom?: number; animatedBottom?: SharedValue<number> })` — when `animatedBottom` is set the anchor's `bottom` follows it; otherwise the static fallback.
  - `TrailInfoSheet({ trail: Trail; animatedPosition?: SharedValue<number> })`.

- [ ] **Step 1: Add `animatedBottom` to `RecordButton`**

In `src/map/RecordButton.tsx`:

Extend the reanimated import to include `useAnimatedStyle` and the `SharedValue` type:
```tsx
import Animated, { runOnJS, useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated'
```

Change the signature:
```tsx
export function RecordButton({
  extraBottom = 0,
  animatedBottom,
}: {
  extraBottom?: number
  animatedBottom?: SharedValue<number>
}) {
```

Add this hook alongside `ringProps` (before the `if (phase === 'saving') return null` line):
```tsx
  const anchorStyle = useAnimatedStyle(() => ({
    bottom: animatedBottom ? animatedBottom.value : insets.bottom + MapTokens.overlayPadding + extraBottom,
  }))
```

Replace the outer `<View style={[styles.anchor, …]}>…</View>` wrapper with an `Animated.View` that drops the static `bottom` (now owned by `anchorStyle`):
```tsx
    <Animated.View style={[styles.anchor, { left: MapTokens.overlayPadding }, anchorStyle]}>
```
(and its matching closing tag becomes `</Animated.View>`). Keep everything inside the wrapper unchanged.

- [ ] **Step 2: Create `src/trails/TrailInfoSheet.tsx`**

```tsx
import { StyleSheet, Text, View } from 'react-native'
import type { SharedValue } from 'react-native-reanimated'
import { Trail } from '../data/trails/types'
import { formatDistance, formatElevation, formatMetricsSummary } from '../data/trails/gpx/metrics'
import { useTheme } from '../theme/useTheme'
import { DifficultyBadge } from './DifficultyBadge'
import { MapInfoSheet } from '../map/MapInfoSheet'
import { MetricsGrid } from '../map/MetricsGrid'

export function TrailInfoSheet({
  trail,
  animatedPosition,
}: {
  trail: Trail
  animatedPosition?: SharedValue<number>
}) {
  const c = useTheme()
  return (
    <MapInfoSheet animatedPosition={animatedPosition}>
      <Text style={[styles.name, { color: c.panelContent }]} numberOfLines={1}>{trail.name}</Text>
      <View style={styles.summaryRow}>
        <DifficultyBadge difficulty={trail.difficulty} />
        <Text style={[styles.summary, { color: c.onSurfaceVariant }]}>
          {formatMetricsSummary(trail.metrics)}
        </Text>
      </View>

      <MetricsGrid
        items={[
          { label: 'Distance', value: formatDistance(trail.metrics.distanceMeters) },
          { label: 'Elev. Gain', value: formatElevation(trail.metrics.elevationGainMeters) },
          { label: 'Elev. Loss', value: formatElevation(trail.metrics.elevationLossMeters) },
        ]}
      />

      {trail.description != null && (
        <Text style={[styles.comments, { color: c.panelContent }]}>{trail.description}</Text>
      )}
    </MapInfoSheet>
  )
}

const styles = StyleSheet.create({
  name: { fontSize: 18, fontWeight: '700' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summary: { fontSize: 13, flexShrink: 1 },
  comments: { fontSize: 14, lineHeight: 20 },
})
```

- [ ] **Step 3: Rewrite MapScreen's trail branch and Record/controls wiring**

In `src/map/MapScreen.tsx`:

Replace the import
```tsx
import { TrailInfoCard } from '../trails/TrailInfoCard'
```
with
```tsx
import { TrailInfoSheet } from '../trails/TrailInfoSheet'
```

Change the React import to drop `useState` (only `cardHeight` used it):
```tsx
import { useRef } from 'react'
```

Delete these two lines:
```tsx
  // Measured height of the trail info card, so the controls sit clear above it while it is shown.
  const [cardHeight, setCardHeight] = useState(0)
```
and
```tsx
  const trailLift = mode === 'trail' && trail ? cardHeight + MapTokens.controlsSpacing : 0
```

Replace the Record button line
```tsx
          {mode !== 'activity' && <RecordButton extraBottom={trailLift} />}
```
with
```tsx
          {mode !== 'activity' && (
            <RecordButton animatedBottom={mode === 'trail' ? controlsAnimatedBottom : undefined} />
          )}
```

Replace the `MapControls` block
```tsx
          <MapControls
            onOpenLayers={() => sheetRef.current?.present()}
            extraBottom={trailLift}
            animatedBottom={mode === 'activity' ? controlsAnimatedBottom : undefined}
          />
```
with
```tsx
          <MapControls
            onOpenLayers={() => sheetRef.current?.present()}
            animatedBottom={mode === 'activity' || mode === 'trail' ? controlsAnimatedBottom : undefined}
          />
```

Replace the trail info card block
```tsx
          {mode === 'trail' && trail && (
            <TrailInfoCard trail={trail} onClose={clearSelection} onHeightChange={setCardHeight} />
          )}
```
with
```tsx
          {mode === 'trail' && trail && (
            <>
              <MapModeChip
                icon="trail-sign"
                color={c.trailLine}
                label={`Viewing trail · ${trail.name}`}
                onExit={clearSelection}
              />
              <TrailInfoSheet trail={trail} animatedPosition={sheetTop} />
            </>
          )}
```

- [ ] **Step 4: Delete the old banner**

```bash
git rm src/trails/TrailInfoCard.tsx
```

- [ ] **Step 5: Verify types and tests**

Run: `npx tsc --noEmit` → clean.
Run: `npx jest` → all existing suites green.
Run the seam check → `SEAM CLEAN`.

Confirm no stale references remain:
```bash
grep -rn "TrailInfoCard\|cardHeight\|trailLift\|ActivityModeChip" src || echo "NO STALE REFS"
```
Expected: `NO STALE REFS`.

- [ ] **Step 6: Commit**

```bash
git add src/map/RecordButton.tsx src/trails/TrailInfoSheet.tsx src/map/MapScreen.tsx
git commit -m "feat: show the selected trail in a draggable sheet like activities"
```

---

### Task 4: Remove the now-dead `extraBottom` prop

With `trailLift` gone, nothing feeds `extraBottom` anymore. Remove it from both components so no dead prop lingers.

**Files:**
- Modify: `src/map/RecordButton.tsx`
- Modify: `src/map/MapControls.tsx`

**Interfaces:**
- Produces: `RecordButton({ animatedBottom?: SharedValue<number> })`; `MapControls({ onOpenLayers, animatedBottom? })`.

- [ ] **Step 1: Confirm nothing passes `extraBottom`**

```bash
grep -rn "extraBottom" src
```
Expected: matches only inside `RecordButton.tsx` and `MapControls.tsx` (definitions/usages), never a call site. If any call site passes it, stop — Task 3 was left incomplete.

- [ ] **Step 2: Drop `extraBottom` from `RecordButton`**

In `src/map/RecordButton.tsx`, change the signature to:
```tsx
export function RecordButton({ animatedBottom }: { animatedBottom?: SharedValue<number> }) {
```
and update `anchorStyle` to drop the `+ extraBottom` term:
```tsx
  const anchorStyle = useAnimatedStyle(() => ({
    bottom: animatedBottom ? animatedBottom.value : insets.bottom + MapTokens.overlayPadding,
  }))
```

- [ ] **Step 3: Drop `extraBottom` from `MapControls`**

In `src/map/MapControls.tsx`, change the signature to:
```tsx
export function MapControls({
  onOpenLayers,
  animatedBottom,
}: {
  onOpenLayers: () => void
  // When set (a selection is active), the cluster tracks the sheet's animated top edge so it rides
  // above the variable-height sheet. Otherwise it sits above the static overlay.
  animatedBottom?: SharedValue<number>
}) {
```
and update `containerStyle` to drop the `+ extraBottom` term:
```tsx
  const containerStyle = useAnimatedStyle(() => ({
    bottom: animatedBottom ? animatedBottom.value : insets.bottom + MapTokens.overlayPadding,
  }))
```

- [ ] **Step 4: Verify types and tests**

Run: `npx tsc --noEmit` → clean.
Run: `npx jest` → all existing suites green.
Run the seam check → `SEAM CLEAN`.
```bash
grep -rn "extraBottom" src || echo "NO EXTRABOTTOM"
```
Expected: `NO EXTRABOTTOM`.

- [ ] **Step 5: Commit**

```bash
git add src/map/RecordButton.tsx src/map/MapControls.tsx
git commit -m "refactor: drop the now-dead extraBottom prop from the map overlays"
```

---

## Device Verification (after all tasks, by the user)

On phone SWWC4HEIYHZPQWZX (Metro already running with `adb reverse`):

- Selecting a trail shows the draggable sheet; dragging between the two snap points works.
- The Play button and the right-side controls both ride the sheet's top edge as it drags.
- The `Viewing trail · <name>` pill dismisses the trail from the map.
- The expanded trail sheet shows the metrics grid (Distance / Elev. Gain / Elev. Loss) and the description when the trail has one.
- Activity mode is unchanged: Record hidden, controls ride the sheet, content identical to before.
