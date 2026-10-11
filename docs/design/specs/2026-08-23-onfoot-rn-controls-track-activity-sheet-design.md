# Map controls track the activity sheet — Design

**Date:** 2026-08-23
**Status:** Design approved
**Context:** Slice 3 follow-up (branch `feat/activities-list-view`, pre-merge). Device testing surfaced a layout bug.

## Problem

The bottom-right map controls (`MapControls`: north / 3D / layers / recenter) are hidden behind
the activity info sheet in Activity mode. The existing lift mechanism — `extraBottom`, a *static*
measured height of `TrailInfoCard` — cannot cope with the activity sheet, whose height is variable
(collapsed `16%` ↔ expanded `55%`) and **animated** as the user drags between snap points.

## Decision

Keep the controls where they are — they are map controls (they act on the map) and are shown in
Free / Trail / Recording modes where there is no sheet, so relocating them into the sheet's tree
would fork their rendering and couple them to the sheet. Instead, make their vertical position
**track the sheet's animated top edge** so they ride continuously above it at any height.

This is a generalization of the pattern already in place — "lift the controls above whatever bottom
overlay is showing" — not a new concept:

- **Trail mode:** lift by a static measured height (`cardHeight` + spacing). Unchanged.
- **Activity mode:** lift by an animated height derived from the sheet's live position.

The same seam will serve the future above-sheet elevation graph.

## Approach

`@gorhom/bottom-sheet`'s `<BottomSheet>` accepts an `animatedPosition` shared value — the Y
coordinate of the sheet's top edge, which animates as the sheet moves. We drive the controls'
bottom offset from it via Reanimated:

- `MapScreen` owns two shared values: `rootHeight` (its root `View` height, set in `onLayout`) and
  `sheetTop` (passed to `ActivityInfoSheet`, which forwards it to `<BottomSheet animatedPosition>`).
- A derived bottom offset for the controls, in Activity mode:
  `controlsBottom = (rootHeight - sheetTop) + MapTokens.controlsSpacing`
  i.e. the sheet's visible height (from the container bottom) plus the standard control spacing, so
  the cluster sits just above the sheet's top edge and animates with it.
- `MapControls` gains an optional `animatedBottom?: SharedValue<number>` prop. When provided, its
  container is a `Reanimated.View` whose `bottom` reads that shared value. When absent (Free / Trail
  / Recording), it keeps the current static path (`bottom = insets.bottom + overlayPadding +
  extraBottom`). One localized branch; no fork of the component.
- `ActivityInfoSheet` gains an optional `animatedPosition?: SharedValue<number>` prop forwarded to
  its `BottomSheet`. No other change to the sheet.

`RecordButton` is unchanged: it is hidden in Activity mode, so it never coexists with the sheet and
keeps its static `extraBottom` lift.

## Scope

- Modify: `src/map/MapControls.tsx` (optional animated bottom).
- Modify: `src/map/ActivityInfoSheet.tsx` (forward `animatedPosition`).
- Modify: `src/map/MapScreen.tsx` (own `rootHeight`/`sheetTop`, derive the animated bottom, wire it
  into `MapControls` in Activity mode; measure root height via `onLayout`).

Out of scope: reworking the trail-card lift (works today, left static); the elevation graph itself;
any change to the record button.

## Testing

Pure layout/animation → **device-verified**, consistent with the project's rule that map rendering,
gestures, and camera behaviour are verified on-device, not unit-tested. The bottom-offset formula is
trivial arithmetic inside a worklet.

Device check: enter Activity mode; the controls sit just above the collapsed sheet; dragging the
sheet up/down slides the controls smoothly so they stay above it at every height; exiting Activity
mode returns them to their normal position.

## Guardrails (AGENTS.md)

- No quick-fix: the static `extraBottom` is generalized to an animated source at the right layer,
  not papered over. Map-provider seam untouched (this is layout, not map SDK). Units stay small and
  single-purpose. No new persisted state.
