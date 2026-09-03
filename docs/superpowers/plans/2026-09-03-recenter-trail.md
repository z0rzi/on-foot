# Re-centre Displayed Trail / Activity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a one-tap "Frame route" map control that re-fits the camera to the selected trail's or activity's full bounds.

**Architecture:** Reuse the existing one-shot-fit machinery. A new pure store action `recenter()` re-arms `pendingFit` for the current selection (and forces `followMode:'off'`); `MapCanvas` already consumes `pendingFit` by calling the provider port's `fitBounds`. A new `ControlButton` in the right-hand camera cluster invokes it, rendered only when a trail/activity is selected. The map-provider seam is untouched — `fitBounds` is already a declared port affordance.

**Tech Stack:** React Native (Expo), Zustand (`persist`), `@expo/vector-icons` Ionicons, Jest.

## Global Constraints

- **Map-provider seam is inviolable** — only `src/map/providers/<provider>/` may import a map SDK. This feature adds no SDK import; it reuses the existing `CameraController.fitBounds` port affordance.
- **Pure logic is TDD'd (Jest first); native rendering/layout is device-verified**, not unit-tested (per `AGENTS.md`).
- **No over-commenting** — self-documenting code; comments describe current state, not changes.
- **Follow the existing callback-passing pattern** (`onExit`, `onViewLinkedTrail`) — leaf components receive callbacks, they do not reach into store selection state.
- Store actions that conditionally no-op use the `set((s) => ...)` form returning `{}` for the no-op (matches `quickSwitchMapStyle`). The store factory currently destructures only `set` — do **not** introduce `get`.
- Icon: Ionicons `scan-outline`, size `MapTokens.controlIconSize`; button size stays `MapTokens.controlSize` (36 pt) — not smaller.

---

### Task 1: `recenter()` store action

**Files:**
- Modify: `src/store/mapStore.ts` (add `recenter` to the `MapStore` interface near line 191, and its implementation in the store body near line 236)
- Test: `src/store/__tests__/mapStore.test.ts` (add cases to the existing `describe('store actions', ...)` block)

**Interfaces:**
- Consumes: existing `selection: Selection | null`, `pendingFit: PendingFit | null` (`{ kind: 'trail' | 'activity'; id: number }`), `followMode`.
- Produces: `recenter: () => void` on the store — re-arms `pendingFit` to `{ kind, id }` of the current selection with a **fresh object reference** and sets `followMode: 'off'`; no-op when `selection` is `null`.

- [ ] **Step 1: Write the failing tests**

Add these tests inside the existing `describe('store actions', () => { ... })` block in `src/store/__tests__/mapStore.test.ts` (the `beforeEach` there already resets the store):

```ts
test('recenter re-arms the pending fit for the selected trail and turns follow off', () => {
  useMapStore.setState({ followMode: 'positionAndBearing', selection: { kind: 'trail', id: 7 }, pendingFit: null })
  useMapStore.getState().recenter()
  expect(useMapStore.getState().pendingFit).toEqual({ kind: 'trail', id: 7 })
  expect(useMapStore.getState().followMode).toBe('off')
  expect(useMapStore.getState().selection).toEqual({ kind: 'trail', id: 7 })
})
test('recenter re-arms the pending fit for the selected activity', () => {
  useMapStore.setState({ followMode: 'position', selection: { kind: 'activity', id: 4 }, pendingFit: null })
  useMapStore.getState().recenter()
  expect(useMapStore.getState().pendingFit).toEqual({ kind: 'activity', id: 4 })
  expect(useMapStore.getState().followMode).toBe('off')
})
test('recenter is a no-op when nothing is selected', () => {
  useMapStore.setState({ selection: null, pendingFit: null, followMode: 'position' })
  useMapStore.getState().recenter()
  expect(useMapStore.getState().pendingFit).toBeNull()
  expect(useMapStore.getState().followMode).toBe('position')
})
test('recenter produces a fresh pendingFit reference even when it already targets the selection', () => {
  const existing = { kind: 'trail' as const, id: 7 }
  useMapStore.setState({ selection: { kind: 'trail', id: 7 }, pendingFit: existing, followMode: 'off' })
  useMapStore.getState().recenter()
  const next = useMapStore.getState().pendingFit
  expect(next).toEqual({ kind: 'trail', id: 7 })
  expect(next).not.toBe(existing)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/store/__tests__/mapStore.test.ts -t recenter`
Expected: FAIL — `useMapStore.getState().recenter is not a function`.

- [ ] **Step 3: Declare the action on the interface**

In `src/store/mapStore.ts`, in the `interface MapStore { ... }`, add the signature right after `clearPendingFit: () => void`:

```ts
  recenter: () => void
```

- [ ] **Step 4: Implement the action**

In the store body (the object returned by the `persist` initializer), add `recenter` right after the `clearPendingFit` line:

```ts
      recenter: () =>
        set((s) =>
          s.selection
            ? { pendingFit: { kind: s.selection.kind, id: s.selection.id }, followMode: 'off' }
            : {},
        ),
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest src/store/__tests__/mapStore.test.ts -t recenter`
Expected: PASS (4 tests).

- [ ] **Step 6: Run the full suite to confirm nothing regressed**

Run: `npx jest`
Expected: all suites pass (baseline was 35 suites / 274 tests; now +4 tests).

- [ ] **Step 7: Commit**

```bash
git add src/store/mapStore.ts src/store/__tests__/mapStore.test.ts
git commit -m "feat(map): recenter store action re-arms pending fit for the selection"
```

---

### Task 2: "Frame route" control button + wiring

**Files:**
- Modify: `src/map/MapControls.tsx` (add optional `onFrameRoute` prop; render a `ControlButton` in a bottom row with the existing center-on-location button)
- Modify: `src/map/MapScreen.tsx` (pull `recenter` from the store; pass `onFrameRoute` to `MapControls` only in trail/activity mode)

**Interfaces:**
- Consumes: `recenter: () => void` from `useMapStore` (Task 1); `mapMode(...)` (already imported in `MapScreen`); `ControlButton`, `MapTokens.controlSize`, `MapTokens.controlIconSize`, `MapTokens.controlsSpacing` (already in scope in `MapControls`).
- Produces: a `MapControls` prop `onFrameRoute?: () => void`. When defined, `MapControls` renders the frame button to the **left of** center-on-location; when undefined, the button is absent.

This task is native UI/layout — **device-verified, not unit-tested** (per `AGENTS.md`). Steps below cover typecheck, lint, full-suite regression, and on-device verification.

- [ ] **Step 1: Add the `onFrameRoute` prop and Ionicons import to `MapControls`**

In `src/map/MapControls.tsx`, add the import near the other icon imports:

```tsx
import { Ionicons } from '@expo/vector-icons'
```

Extend the component's props (the destructured object and its type):

```tsx
export function MapControls({
  onOpenLayers,
  onFrameRoute,
  animatedBottom,
}: {
  onOpenLayers: () => void
  onFrameRoute?: () => void
  // When set (a selection is active), the cluster tracks the sheet's animated top edge so it rides
  // above the variable-height sheet. Otherwise it sits above the static overlay.
  animatedBottom?: SharedValue<number>
}) {
```

- [ ] **Step 2: Render the frame button on a shared bottom row with center-on-location**

In `src/map/MapControls.tsx`, replace the existing center-on-location `ControlButton` (the last child of the `Animated.View`, currently:)

```tsx
      <ControlButton accessibilityLabel="Center on your location" onPress={cycleFollowMode}>
        <LocationIcon size={MapTokens.controlIconSize} color={following ? c.controlAccent : c.controlContent} />
      </ControlButton>
```

with a right-aligned row that places the frame button to its left:

```tsx
      <View style={styles.bottomRow}>
        {onFrameRoute && (
          <ControlButton accessibilityLabel="Frame the whole route" onPress={onFrameRoute}>
            <Ionicons name="scan-outline" size={MapTokens.controlIconSize} color={c.controlContent} />
          </ControlButton>
        )}
        <ControlButton accessibilityLabel="Center on your location" onPress={cycleFollowMode}>
          <LocationIcon size={MapTokens.controlIconSize} color={following ? c.controlAccent : c.controlContent} />
        </ControlButton>
      </View>
```

Add the `bottomRow` style to the `StyleSheet.create({ ... })` at the bottom of the file (the row inherits the column's right alignment; give it the same inter-button gap and vertical centering):

```tsx
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: MapTokens.controlsSpacing },
```

- [ ] **Step 3: Pass `onFrameRoute` from `MapScreen` only in trail/activity mode**

In `src/map/MapScreen.tsx`, add the store selector next to the existing selection actions (near `const clearSelection = useMapStore((s) => s.clearSelection)`):

```tsx
  const recenter = useMapStore((s) => s.recenter)
```

Then update the `MapControls` usage (currently passing `onOpenLayers` and `animatedBottom`) to also pass `onFrameRoute` when a route is selected:

```tsx
        <MapControls
          onOpenLayers={() => sheetRef.current?.present()}
          onFrameRoute={mode === 'trail' || mode === 'activity' ? recenter : undefined}
          animatedBottom={mode !== 'free' ? controlsBottom : undefined}
        />
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: no new errors for `src/map/MapControls.tsx` or `src/map/MapScreen.tsx`.

- [ ] **Step 6: Full test suite (guard against regressions, incl. the seam test)**

Run: `npx jest`
Expected: all suites pass — in particular `src/architecture/__tests__/seams.test.ts` (confirms no new SDK import crossed the seam).

- [ ] **Step 7: Device verification**

Launch the app (`npm run android` / `npm run ios`) and confirm:
1. In **free** mode (nothing selected) and **recording** mode: no frame button (only the usual cluster).
2. Select a **trail**: a `scan-outline` button appears immediately to the **left of** center-on-location; the north / 3D / layers / center buttons do **not** shift position.
3. Pan/zoom away, tap the frame button → camera re-fits the whole trail.
4. Tap **center-on-location** (follow on), then tap the frame button → it still re-fits the trail (proves the `followMode:'off'` reset).
5. Repeat 2–4 for a selected **activity**.

- [ ] **Step 8: Commit**

```bash
git add src/map/MapControls.tsx src/map/MapScreen.tsx
git commit -m "feat(map): frame-route control re-centres the selected trail/activity"
```

---

## Self-Review

**Spec coverage:**
- Frame-route control in the camera cluster, left of center-on-location, same row → Task 2 Steps 2–3. ✓
- 36 pt, not smaller; Ionicons `scan-outline` → Global Constraints + Task 2 Step 2. ✓
- Shown only for trail/activity (absent in free/recording) → Task 2 Step 3 (`mode === 'trail' || 'activity'`) + verification Step 7.1. ✓
- Left-of placement so the persistent column doesn't reflow → Task 2 Step 2 (bottom row) + verification Step 7.2. ✓
- Reuse `pendingFit` → `fitBounds`; new pure `recenter()` re-arming fit + `followMode:'off'` → Task 1. ✓
- Fresh `pendingFit` reference re-fires the `MapCanvas` effect → Task 1 Step 1 (4th test) + Step 4. ✓
- `followMode:'off'` so fit isn't a no-op after follow → Task 1 tests + verification Step 7.4. ✓
- Seam untouched → Global Constraints + Task 2 Step 6 (seams test). ✓
- `recenter` TDD'd; button device-verified → Task 1 (Jest) / Task 2 (device). ✓

**Placeholder scan:** No TBD/TODO/vague steps; every code step shows the exact code. ✓

**Type consistency:** `recenter: () => void` defined in Task 1 and consumed identically in Task 2; `onFrameRoute?: () => void` defined and consumed consistently; `PendingFit` / `Selection` shapes match the store. ✓
