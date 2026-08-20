# Layer Quick-Switch & Tap-Outside Implementation Plan

> **For agentic workers:** implement task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Swiping the layers control button quick-switches the map style (previous layer, else satellite-toggle), and tapping outside the layers sheet closes it.

**Architecture:** Pure resolution logic + session state live in the provider-agnostic Zustand store; the satellite concept is declared on the provider port as a semantic flag (never a hardcoded id in shared code). The gesture mirrors the existing 3D-button `Gesture.Pan` pattern; the backdrop uses `@gorhom/bottom-sheet` v5's `BottomSheetBackdrop`.

**Tech Stack:** TypeScript, Zustand 5 (+persist), react-native-gesture-handler, @gorhom/bottom-sheet 5, Jest.

## Global Constraints

- The map-provider seam is inviolable: only `src/map/providers/<provider>/` imports the SDK; the store stays provider-agnostic (no `MAPBOX_STYLES` import, no `'satellite'` literal).
- Pure logic is TDD'd (Jest first); native gesture/backdrop is device-verified.
- Persist the minimum: `previousMapStyleId` is session-only (not in `partialize`).
- Full spec: `docs/superpowers/specs/2026-08-20-onfoot-rn-layer-quick-switch-and-tap-outside.md`.

---

### Task 1: Provider-port satellite flag

**Files:**
- Modify: `src/map/provider/types.ts` (`StyleDescriptor`)
- Modify: `src/map/providers/mapbox/styles.ts`

**Interfaces:**
- Produces: `StyleDescriptor.satellite?: boolean` consumed by the store logic and MapControls.

- [ ] Add `satellite?: boolean` to `StyleDescriptor`.
- [ ] Set `satellite: true` on the `satellite` entry in `MAPBOX_STYLES`.
- [ ] `npx tsc --noEmit` clean.

### Task 2: Pure resolution helpers (TDD)

**Files:**
- Modify: `src/store/mapStore.ts`
- Test: `src/store/__tests__/mapStore.test.ts`

**Interfaces:**
- Produces: `StyleChoice { id: string; satellite?: boolean }`,
  `satelliteToggleTarget(currentId: string, styles: StyleChoice[]): string`,
  `resolveQuickSwitch(currentId: string, previousId: string | null, styles: StyleChoice[]): string`.

- [ ] **Write failing tests** for `satelliteToggleTarget`: non-satellite→satellite; satellite→first non-satellite; single-style/no-satellite list→returns currentId.
- [ ] **Write failing tests** for `resolveQuickSwitch`: valid previous wins; null/equal-to-current/absent-from-list previous → falls through to satellite toggle.
- [ ] Run: `npx jest mapStore` → FAIL (helpers not exported).
- [ ] Implement both pure helpers (exported).
- [ ] Run: `npx jest mapStore` → PASS.

### Task 3: Store state + actions (TDD)

**Files:**
- Modify: `src/store/mapStore.ts`
- Test: `src/store/__tests__/mapStore.test.ts`

**Interfaces:**
- Produces: store field `previousMapStyleId: string | null`; action `quickSwitchMapStyle(styles: StyleChoice[]): void`; `setMapStyle` records previous on change.

- [ ] **Write failing tests**: `setMapStyle` records outgoing id as `previousMapStyleId` on change, leaves it untouched when id unchanged; `quickSwitchMapStyle` swaps to resolved target and records previous; two calls A/B-toggle; no-op when target equals current; `previousMapStyleId` not persisted (absent from `partialize`).
- [ ] Run: `npx jest mapStore` → FAIL.
- [ ] Add `previousMapStyleId: null` to initial state and the `MapStore` interface; update `setMapStyle`; add `quickSwitchMapStyle`. Keep `partialize` = `{ mapStyleId }` only.
- [ ] Run: `npx jest mapStore` → PASS.

### Task 4: Swipe token

**Files:**
- Modify: `src/theme/tokens.ts`

- [ ] Add `layerSwipeThreshold: 20` to `MapTokens`.

### Task 5: Layers-button gesture

**Files:**
- Modify: `src/map/MapControls.tsx`

**Interfaces:**
- Consumes: `quickSwitchMapStyle`, `useMapCapabilities().styles` (with `satellite` flag), `MapTokens.layerSwipeThreshold`.

- [ ] Add `quickSwitchMapStyle` selector; derive `styleChoices = caps.styles.map((s) => ({ id: s.id, satellite: s.satellite }))`.
- [ ] Memoize a `Gesture.Pan` (deps `[quickSwitchMapStyle, styleChoices]`) whose `onEnd` calls `quickSwitchMapStyle(styleChoices)` when `Math.hypot(translationX, translationY) > MapTokens.layerSwipeThreshold`; `.runOnJS(true)`.
- [ ] Wrap the layers `ControlButton` in `<GestureDetector>` (tap still calls `onOpenLayers`).
- [ ] `npx tsc --noEmit` clean.

### Task 6: Tap-outside backdrop

**Files:**
- Modify: `src/map/LayersSheet.tsx`

- [ ] Add a memoized `renderBackdrop` using `BottomSheetBackdrop` (`appearsOnIndex={0}`, `disappearsOnIndex={-1}`, `pressBehavior="close"`); pass as `backdropComponent`.
- [ ] `npx tsc --noEmit` clean.

### Task 7: Verify + commit

- [ ] `npx tsc --noEmit` clean; `npx jest` all green.
- [ ] Device-verify: swipe switches layer without opening sheet; tap opens sheet; A/B toggle; cold-start satellite toggle; tap-outside closes; swipe-down still closes.
- [ ] Commit: `feat: quick-switch map layer by swiping the layers button + tap-outside to close`.
