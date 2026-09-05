# Re-centre Displayed Trail / Activity — Design

**Date:** 2026-09-03
**Status:** Approved for planning

## Problem

When a trail or activity is selected, the camera frames the whole route once (on
selection). After that, panning or zooming away — or tapping *center-on-location* to
follow the puck — leaves no one-tap way back to "show me the whole route again." The
user has to pinch-zoom-pan by hand to reframe.

## Feature

A one-tap **Frame route** control that re-frames the camera to fit the entire selected
trail or activity, identical to the framing that happens on initial selection.

### Scope (this feature)

- A new map control button that re-fits the camera to the selected route's bounds.
- Shown whenever a route is selected to frame: a **trail**, an **activity**, or a
  **followed trail while recording**. Hidden in free recording (no followed trail) and
  when nothing is selected. In code this is the single condition "a selection exists",
  since a followed trail is the selection during recording.
- Re-fits the whole route (same bounds fit as selection) — not a centre-only pan.
- **Flattens the camera to 2D on focus** (pitch → `pitchMin`, animated); **bearing is left
  untouched** (no rotate-to-north). This applies both to the button and to the automatic
  framing when a trail/activity is first opened (`select`), so an opened route is always
  shown top-down.

### Out of scope

- **Framing a free recording (live track).** When recording without a followed trail there
  is no selection and no trail/activity geometry to fit; framing the live recorded track
  would need new plumbing (a live-track fit path in `MapCanvas`) and is deliberately left
  out. The button is simply hidden in that case.
- **Centre-only-keep-zoom.** Would need a new camera affordance on the provider port; not
  worth it. "Frame the route" is the useful action and reuses the existing fit path.
- **Rotate-to-north on focus.** Bearing is intentionally preserved; only pitch is reset.
- **Tapping the title.** Considered and rejected — see UX rationale below.

## UX decision — a map control, not a tappable title

The affordance lives in the existing right-hand **camera-control cluster**
(`MapControls`), immediately to the **left of** *center-on-location*, on the same row.

Why here rather than a tappable title or a button beside the title:

- **One mental model.** The cluster is already the home of every camera-movement
  affordance (reset-north, 2D/3D, layers, center-on-location). "Frame the route" is a
  camera move and belongs with its siblings. *Center-on-me* and *frame-the-route* become
  an obvious adjacent pair. A button beside the title would scatter camera controls
  across the screen.
- **Visible affordance.** A titled icon button is discoverable; a tappable *title* is an
  invisible, unlearned affordance (titles read as inert or as "navigate to detail", not
  "move the camera").
- **No gesture ambiguity.** The sheet title sits on a draggable surface; a tap target
  there fights the sheet's pan. Keeping the control out of the sheet avoids it.
- **Matches the category leaders** (AllTrails / Gaia / Komoot / Google Maps all treat
  recenter / fit-route as a map control).

### Placement & size

- **To the left of** center-on-location, on a shared bottom row — not stacked under it.
  Because the button is contextual (only present when a route is selected), a *stacked*
  layout would grow the persistent column taller and reflow it on every selection.
  Left-of means the always-present controls (north / 3D / layers / center) never move;
  the frame button simply appears beside center-on-location.
- **Same 36 pt size** as the other controls (`MapTokens.controlSize`) — explicitly **not
  smaller**. 36 pt is already at the ergonomic floor (below the 44 pt / 48 dp touch-target
  guideline); shrinking a control tapped mid-hike (motion, gloves, sun) hurts hit rate,
  and a one-off smaller circle breaks the cluster's visual rhythm. Its contextual
  appearance already conveys "secondary / situational" without shrinking the target.
- **Icon:** a fit-to-bounds / frame glyph (e.g. Ionicons `scan-outline`, corner-frame
  marks). The cluster already mixes custom SVG icons and Ionicons, so an Ionicon is
  acceptable to start and can be swapped for a custom SVG on device.
- **Accessibility:** `accessibilityLabel` "Frame the whole route".

## Architecture

### Section 1 — Store action (pure, TDD)

The framing machinery already exists and is **reused verbatim**: `select()` sets a
one-shot `pendingFit`, which `MapCanvas` consumes by calling
`cameraRef.current.fitBounds(...)` once the route geometry has loaded, then clears it.

Add a single store action to `src/store/mapStore.ts` that re-arms that one-shot fit for
the **already-selected** item:

```ts
recenter: () =>
  set((s) =>
    s.selection
      ? {
          pendingFit: { kind: s.selection.kind, id: s.selection.id },
          followMode: 'off',
          cameraPitch: MapTokens.pitchMin,
          pitchAnimated: true,
        }
      : {},
  ),
```

Three properties make this correct with no other logic:

- **Fresh `pendingFit` reference** re-fires the `MapCanvas` effect even though the same
  item is still selected (the effect keys on `pendingFit`).
- **`followMode: 'off'`** guarantees the imperative `fitBounds` is not swallowed while
  rnmapbox is following the puck — mirrors exactly what `select()` already does. Without
  it, tapping frame-route after center-on-location would be a silent no-op.
- **`cameraPitch: pitchMin` + `pitchAnimated`** flattens a 3D view to top-down 2D on focus
  (MapCanvas applies the declarative pitch once follow is off); bearing is deliberately
  left alone. The **same two fields are added to `select`**, so the automatic framing when
  a route is first opened is also 2D. Uses the `set((s) => … : {})` no-op form of
  `quickSwitchMapStyle`; no `get` introduced.

No new camera code, and **the map-provider seam is untouched** — `fitBounds` is already a
declared affordance on the provider port.

### Section 2 — Control wiring (native, device-verified)

- **`MapControls`** gains an optional prop (e.g. `onFrameRoute?: () => void`). When set,
  it renders one extra `ControlButton` on a right-aligned bottom **row** together with the
  existing center-on-location button, so the frame button sits to its left and nothing
  above reflows. Everything continues to ride the sheet via the existing `animatedBottom`.
- **`MapScreen`** pulls `recenter` from the store (next to `select` / `clearSelection`)
  and passes `onFrameRoute={selection ? recenter : undefined}` to `MapControls` — i.e.
  whenever a route is selected to frame (trail, activity, or followed trail while
  recording), and omitted otherwise (free recording, free mode). This follows the existing
  callback-passing pattern (`onExit`, `onViewLinkedTrail`) rather than having `MapControls`
  reach into the
  selection state itself.

### Section 3 — Testing

- **TDD (Jest) — the `recenter` action (pure):**
  - with a trail selection → sets `pendingFit` to `{ kind:'trail', id }` and
    `followMode:'off'`;
  - with an activity selection → same for `activity`;
  - with **no** selection → no-op (state unchanged).
- **Device-verified:** button appears only for trail/activity, sits left of
  center-on-location without reflowing the column, and tapping it reframes the route
  (including after center-on-location, proving the `followMode:'off'` reset) — per the
  codebase rule that rendering and layout are device-checked.
