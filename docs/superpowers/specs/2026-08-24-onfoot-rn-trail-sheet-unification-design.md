# Trail Info Sheet Unification — Design

**Date:** 2026-08-24

## Goal

Replace the trail's floating info banner (`TrailInfoCard`) with the same draggable
bottom sheet the activity view uses, and extract the genuinely shared pieces so neither
sheet re-implements the chrome. After this change, trail and activity selection render
through one symmetric path.

## Background

Two divergent presentations exist today for a map selection:

- **Trail** (`mapMode === 'trail'`): a floating `TrailInfoCard` anchored near the bottom
  (thumb icon, name, `DifficultyBadge`, one-line metrics, an X to close). The card reports
  its measured height (`onHeightChange`); MapScreen turns that into a static `trailLift`
  that pushes the Record button and the right-side controls up above it. Record button is
  visible.
- **Activity** (`mapMode === 'activity'`): a `@gorhom/bottom-sheet` (`ActivityInfoSheet`)
  with snap points `['16%', '55%']`, no pan-to-close, richer content (metrics grid,
  comments, linked-trail button). Exit is via `ActivityModeChip` (a top pill). The Record
  button is hidden; the right-side controls ride the sheet's live top edge via
  `animatedPosition` → `sheetTop` → `controlsAnimatedBottom` (a `useDerivedValue` in
  MapScreen).

The sheet is the newer, better solution. This design brings trails onto it.

## Requirements

1. The trail selection renders a draggable bottom sheet, not a floating card.
2. The trail sheet **mirrors the activity sheet's layout**: collapsed shows name +
   `DifficultyBadge` + one-line summary; expanded reveals a metrics grid
   (Distance / Elev. Gain / Elev. Loss) and the trail description when present.
3. A top pill — `Viewing trail · <name>` with a cross — dismisses the trail selection
   (mirrors the activity pill).
4. The Record (Play) button **stays visible** while viewing a trail, and its bottom offset
   **rides the sheet position** exactly like the right-side map controls do (via
   `animatedBottom`), instead of the old static lift.
5. Activity mode behaviour is unchanged (Record still hidden there; controls still ride
   the sheet; content identical).
6. No dead code left behind (see Dead-Code Removal).

## Architecture

Collapse the trail path onto the activity path. Extract three shared units; keep the two
domain-specific content components thin.

### Shared units

| Unit | Location | Responsibility |
|------|----------|----------------|
| `MapInfoSheet` | `src/map/MapInfoSheet.tsx` (new) | Owns the `BottomSheet` chrome: `index={0}`, `snapPoints={['16%','55%']}`, `enablePanDownToClose={false}`, `animatedPosition` wiring, `backgroundStyle`/`handleIndicatorStyle` theming. Renders `children` inside a `BottomSheetView`. |
| `MetricsGrid` | `src/map/MetricsGrid.tsx` (new) | The metrics row + `Metric` atom, driven by an `items: { label: string; value: string }[]` array. `space-evenly` handles 3 (trail) or 4 (activity) items. Owns the grid + item styles currently inline in `ActivityInfoSheet`. |
| `MapModeChip` | `src/map/MapModeChip.tsx` (renamed from `ActivityModeChip`) | Generalized top pill. Props: `label: string`, `icon: keyof typeof Ionicons.glyphMap`, `color: string`, `onExit: () => void`. |

### Domain content components

| Unit | Location | Notes |
|------|----------|-------|
| `TrailInfoSheet` | `src/trails/TrailInfoSheet.tsx` (new) | Trail content built on `MapInfoSheet` + `MetricsGrid`. Summary row: `DifficultyBadge` + `formatMetricsSummary(trail.metrics)`. Metrics grid: Distance (`formatDistance`), Elev. Gain (`formatElevation`), Elev. Loss (`formatElevation`). Renders `trail.description` when non-null (same treatment `ActivityInfoSheet` gives `comments`). No linked-trail affordance (trails don't link out). Takes `animatedPosition?: SharedValue<number>`. |
| `ActivityInfoSheet` | `src/map/ActivityInfoSheet.tsx` (refactored) | Same content and behaviour as today, now built on `MapInfoSheet` + `MetricsGrid`. The linked-trail lookup (async + cancel guard) and the linked-trail button stay here — activity-specific. |

### MapScreen wiring

MapScreen becomes symmetric across the two selection modes:

- Both modes render their domain sheet (passing `animatedPosition={sheetTop}`) and a
  `MapModeChip`:
  - activity → `walk` icon, `c.activityLine`, `Viewing activity · <name>`
  - trail → `trail-sign` icon (e.g. `trail-sign-outline`/`trail-sign`), `c.trailLine`,
    `Viewing trail · <name>`
  - both call `clearSelection` on exit.
- The right-side controls ride the sheet in **both** selection modes:
  `animatedBottom={controlsAnimatedBottom}` when `mode === 'trail' || mode === 'activity'`.
- The Record button:
  - `mode === 'activity'` → not rendered (unchanged).
  - `mode === 'trail'` → rendered with `animatedBottom={controlsAnimatedBottom}`.
  - `free` / `recording` → rendered with no `animatedBottom` (static position).
- The `cardHeight` state, `trailLift`, and the now-unused `useState` import are removed.
  The existing `rootHeight` / `sheetTop` / `controlsAnimatedBottom` machinery is reused
  as-is (it already drives activity mode).

### RecordButton change

`RecordButton` gains `animatedBottom?: SharedValue<number>`, mirroring `MapControls`
exactly:

- When `animatedBottom` is set, the anchor's `bottom` follows it via `useAnimatedStyle`
  (anchor becomes an `Animated.View`).
- When absent, it falls back to the static `insets.bottom + MapTokens.overlayPadding`.
- The `extraBottom` prop is removed (see Dead-Code Removal).

## Snap points

Both sheets use `['16%', '55%']`, so `MapInfoSheet` owns the snap points internally — one
definition, no per-caller prop (both current callers want the same values).

## Dead-Code Removal

- **Delete** `src/trails/TrailInfoCard.tsx`. Its only importer is MapScreen.
  `DifficultyBadge` is *not* dead — it's still used by `TrailListItem` and the new
  `TrailInfoSheet`.
- **Delete** `src/map/ActivityModeChip.tsx` — replaced by `MapModeChip.tsx`.
- **MapScreen:** remove `cardHeight` / `setCardHeight`, `trailLift`, and drop `useState`
  from the React import (no longer used).
- **`extraBottom` prop:** remove from both `RecordButton` and `MapControls`. It was only
  ever fed `trailLift`; once that's gone the prop is dead on both.
- No tests reference `TrailInfoCard`, `ActivityModeChip`, or `extraBottom`.

## Error Handling

No new error surfaces — this is a presentation refactor over existing selection data. The
activity linked-trail lookup keeps its current async load + cancel-on-unmount guard in
`ActivityInfoSheet`.

## Testing

Per AGENTS.md, map rendering, gestures, and sheet/animated-position behaviour are
**device-verified**, not unit-tested. There is no new pure logic to TDD — the
trail/activity branching already lives in `mapMode`, which has tests. So:

- **No new Jest specs.**
- **Verification gate:** `npx tsc --noEmit` clean; existing `npx jest` green; map-provider
  seam clean (no SDK import outside `src/map/providers/`).
- **On-device (phone SWWC4HEIYHZPQWZX):**
  - Selecting a trail shows the draggable sheet; drag between snap points works.
  - Play button and the right-side controls both ride the sheet's top edge as it drags.
  - The `Viewing trail · <name>` pill dismisses the selection.
  - Expanded trail sheet shows the metrics grid + description.
  - Activity mode is unchanged (Record hidden, controls ride sheet, content identical).

## Non-Goals

- No change to activity content or behaviour beyond the shared-component refactor.
- No new trail fields surfaced beyond what the banner + description already provide.
- No thumbnail in the trail sheet (mirrors the activity sheet, which has none).
