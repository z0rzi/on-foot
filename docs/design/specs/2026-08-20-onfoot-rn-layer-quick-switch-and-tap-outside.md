# Layer Quick-Switch & Tap-Outside-to-Close — Design

**Date:** 2026-08-20
**Status:** Approved (pending spec review)
**Scope:** Two small, additive map-UI features. No new dependencies. Faithful to the
existing provider-seam architecture (only `map/providers/mapbox/` imports the SDK; the
store stays provider-agnostic).

## Goal

1. **Layer quick-switch by swipe** — swiping the layers control button (in any direction)
   instantly switches the map style without opening the sheet. It switches to the
   *previously selected* layer; if there is no usable previous layer, it falls back to a
   **satellite toggle**.
2. **Tap-outside-to-close** — tapping the dimmed area outside the layers sheet dismisses
   it (today only swipe-down closes it).

These are new behaviours, not present in the Kotlin reference app.

## Feature 1 — Layer quick-switch by swipe

### Interaction

- **Tap** the layers `ControlButton` → open the layers sheet (unchanged).
- **Swipe** the layers `ControlButton` in any direction → quick-switch the layer, no sheet.

Tap vs. swipe is discriminated exactly like the existing 3D button: a memoized
`Gesture.Pan` wraps the button. A real swipe activates the pan (past a small travel
threshold) and RNGH cancels the button's `onPress`, so a tap still cleanly opens the
sheet while a swipe fires the quick-switch and never opens the sheet.

### Target-resolution logic (pure)

Quick-switch picks the target style id as follows:

1. If `previousMapStyleId` is set, differs from the current style, and still exists in the
   provider's style list → **switch to it** (the A/B toggle).
2. Otherwise (cold start / no usable history) → **satellite toggle**:
   - if the current style is **not** the satellite style → switch **to** the satellite style;
   - if the current style **is** the satellite style → switch to the **first non-satellite**
     style in the list.

Every style change — from the sheet *or* from a swipe — records the outgoing style as
`previousMapStyleId`. This makes the swipe a genuine A/B toggle between the two
most-recently-used layers, and the sheet participates in the same pairing.

### Provider-seam addition

The satellite toggle must not hardcode the Mapbox-specific style id `'satellite'` in
provider-agnostic code. Instead, the provider **declares** which style is its satellite /
imagery layer via a new optional semantic marker on the style descriptor:

- `provider/types.ts` — add `satellite?: boolean` to `StyleDescriptor`.
- `providers/mapbox/styles.ts` — set `satellite: true` on the `satellite` style entry.

The pure logic and the store operate only on this flag, never on a literal id. A future
provider (e.g. MapLibre) marks its own imagery style and the behaviour carries over with
no logic change.

### Store changes (`src/store/mapStore.ts`)

New session-only state (NOT persisted — same philosophy as `followMode`; `partialize`
still persists only `mapStyleId`):

- `previousMapStyleId: string | null` (initial `null`).

New pure exported helper (unit-tested directly):

```ts
export interface StyleChoice {
  id: string
  satellite?: boolean
}

// The satellite-toggle fallback: non-satellite -> satellite; satellite -> first
// non-satellite in the list. Falls back to the current id if the list can't satisfy it
// (e.g. a provider with no satellite style, or a single style).
export function satelliteToggleTarget(currentId: string, styles: StyleChoice[]): string

// Quick-switch resolution: valid previous first, else the satellite toggle.
export function resolveQuickSwitch(
  currentId: string,
  previousId: string | null,
  styles: StyleChoice[],
): string
```

`resolveQuickSwitch` contract:
- `previousId` is used only when it is non-null, `!== currentId`, and present in `styles`;
  otherwise `satelliteToggleTarget` is used.

Store action changes:

- `setMapStyle(id)` — additionally records the outgoing style as previous, only when the
  style actually changes:
  `set((s) => id === s.mapStyleId ? { mapStyleId: id } : { mapStyleId: id, previousMapStyleId: s.mapStyleId })`.
- New action `quickSwitchMapStyle(styles: StyleChoice[])` — atomically resolves the target
  and swaps:
  `set((s) => { const target = resolveQuickSwitch(s.mapStyleId, s.previousMapStyleId, styles); return target === s.mapStyleId ? {} : { mapStyleId: target, previousMapStyleId: s.mapStyleId } })`.

The store never imports `MAPBOX_STYLES`; callers pass the style list in, preserving the
seam.

### UI changes (`src/map/MapControls.tsx`)

- Add a `quickSwitchMapStyle` selector and derive `styleChoices` from the existing
  `useMapCapabilities()` (`caps.styles.map((s) => ({ id: s.id, satellite: s.satellite }))`).
- Wrap the layers `ControlButton` in a `GestureDetector` with a memoized `Gesture.Pan`
  (mirroring the 3D button's memo pattern and its stability rationale). On `onEnd`, if the
  gesture's travel magnitude exceeds `MapTokens.layerSwipeThreshold`, call
  `quickSwitchMapStyle(styleChoices)`; the button's `onPress` still opens the sheet for a tap.
- New token `MapTokens.layerSwipeThreshold` (px) in `src/theme/tokens.ts`.

No layer-name toast/label on swipe — the map changes visibly and the reference app has no
such affordance (YAGNI; can be added later if wanted).

## Feature 2 — Tap-outside-to-close (`src/map/LayersSheet.tsx`)

Add a `backdropComponent` to the `BottomSheetModal` using `@gorhom/bottom-sheet` v5's
`BottomSheetBackdrop`:

```tsx
const renderBackdrop = useCallback(
  (props) => (
    <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />
  ),
  [],
)
// ...
<BottomSheetModal ref={ref} snapPoints={snapPoints} backdropComponent={renderBackdrop} ...>
```

Tapping the dimmed area dismisses the sheet; swipe-down continues to work. Purely
additive — no change to layer-selection logic.

## Testing

- **Jest / pure logic** (`src/store/__tests__/mapStore.test.ts`, mirroring existing style):
  - `satelliteToggleTarget`: non-satellite → satellite; satellite → first non-satellite;
    degenerate lists fall back to the current id.
  - `resolveQuickSwitch`: valid previous wins; null / equal / absent previous falls through
    to the satellite toggle.
  - store `setMapStyle`: records previous on change; leaves previous untouched when the id
    is unchanged.
  - store `quickSwitchMapStyle`: swaps to the resolved target and records previous;
    repeated calls A/B-toggle; no-op when the target equals the current style.
- **Device-verified** (like the rest of the map): swipe on the layers button switches the
  layer without opening the sheet; tap still opens it; tapping outside the open sheet
  closes it.

## Non-goals

- No layer-name feedback toast on swipe.
- No persistence of `previousMapStyleId` across app restarts (session-only by design).
- No change to the follow-mode / pitch / camera behaviour.
