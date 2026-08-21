# Restore Last Map State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist which trail is displayed (or that none is) across an app close/reopen, restoring its overlay + info card on launch while the camera keeps following the user's live position.

**Architecture:** Add `selectedTrailId` to the map store's persisted state. De-conflate `selectTrail` so a session-only `trailFitNonce` (mirroring the existing `northResetNonce`) drives the one-shot camera fit, which then fires only on a real user tap — never on restore. Two native consumers (`MapCanvas`, `useSelectedTrail`) are rewired: the fit effect keys on the nonce, and `useSelectedTrail` self-heals a persisted id whose trail was deleted.

**Tech Stack:** Zustand + `persist`/`createJSONStorage` (AsyncStorage), React (expo-router), TypeScript, Jest. `@rnmapbox/maps` stays behind the provider seam (untouched here).

## Global Constraints

- **Expo SDK 57.** Consult the versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing native/Expo code. (No new Expo APIs are used in this slice.)
- **Persist the minimum.** Only `mapStyleId` and (new) `selectedTrailId` go in `partialize`. `followMode`, `trailFitNonce`, `cameraPitch`, `pitchAnimated`, `cameraHeading`, `previousMapStyleId`, `northResetNonce` stay session-only.
- **Map-provider seam is inviolable.** No map SDK import outside `src/map/providers/<provider>/`. This slice adds none.
- **Locked behavior:** on restore, camera **follows the user** (default `followMode: 'position'`); the trail overlay + info card show, but the camera does **not** fit the trail. The one-shot fit is reserved for a real user tap.
- **Pure logic is TDD'd; native rendering is device-verified.** Store logic → Jest first. `MapCanvas`/`useSelectedTrail` (native/effect glue) → device-verified, not unit-tested.
- **Comments:** describe current state only; do not narrate changes. Keep units small and single-purpose.

---

### Task 1: Map store — persist `selectedTrailId` and add the fit nonce

**Files:**
- Modify: `src/store/mapStore.ts`
- Test: `src/store/__tests__/mapStore.test.ts`

**Interfaces:**
- Consumes: existing `MapStore` interface, `selectTrail`, `clearSelectedTrail`, `selectedTrailId`, the `persist` `partialize` option.
- Produces:
  - New store field `trailFitNonce: number` (initial `0`, session-only).
  - `selectTrail(id: number)` now sets `selectedTrailId: id`, `followMode: 'off'`, **and** increments `trailFitNonce`.
  - `partialize` now returns `{ mapStyleId, selectedTrailId }`.
  - `MapCanvas` (Task 2) reads `trailFitNonce`; `useSelectedTrail` (Task 2) keeps using `clearSelectedTrail`.

- [ ] **Step 1: Update the `beforeEach` reset to include the new field**

In `src/store/__tests__/mapStore.test.ts`, add `trailFitNonce: 0` to the `useMapStore.setState({ ... })` block inside `describe('store actions')`'s `beforeEach` (currently lines ~145-155), so it reads:

```ts
  beforeEach(() => {
    useMapStore.setState({
      followMode: 'off',
      mapStyleId: 'standard',
      previousMapStyleId: null,
      selectedTrailId: null,
      cameraPitch: 0,
      pitchAnimated: false,
      cameraHeading: 0,
      northResetNonce: 0,
      trailFitNonce: 0,
    })
  })
```

- [ ] **Step 2: Write/adjust the failing tests**

In `src/store/__tests__/mapStore.test.ts`, **replace** the existing test
`test('selectTrail selects the trail and turns follow off', ...)` (currently lines ~195-200) with this expanded version:

```ts
  test('selectTrail selects the trail, turns follow off, and bumps the fit nonce', () => {
    useMapStore.setState({ followMode: 'positionAndBearing', selectedTrailId: null, trailFitNonce: 3 })
    useMapStore.getState().selectTrail(7)
    expect(useMapStore.getState().selectedTrailId).toBe(7)
    expect(useMapStore.getState().followMode).toBe('off')
    expect(useMapStore.getState().trailFitNonce).toBe(4)
  })
```

Then **replace** the existing test
`test('previousMapStyleId is session-only (not persisted)', ...)` (currently lines ~259-264) with this version, which pins the exact persisted shape now that `selectedTrailId` is included:

```ts
  test('partialize persists only mapStyleId and selectedTrailId', () => {
    const partialize = useMapStore.persist.getOptions().partialize!
    useMapStore.setState({ selectedTrailId: 7 })
    const partial = partialize({ ...useMapStore.getState() } as any)
    expect(partial).toEqual({ mapStyleId: useMapStore.getState().mapStyleId, selectedTrailId: 7 })
    expect(partial).not.toHaveProperty('previousMapStyleId')
    expect(partial).not.toHaveProperty('trailFitNonce')
    expect(partial).not.toHaveProperty('followMode')
  })
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx jest src/store/__tests__/mapStore.test.ts`
Expected: FAIL — `trailFitNonce` is not yet a store field (the `selectTrail` test sees `NaN`/`undefined`), and the `partialize` test fails because `selectedTrailId` is not yet in the persisted partial.

- [ ] **Step 4: Add `trailFitNonce` to the store interface and initial state**

In `src/store/mapStore.ts`, in the `interface MapStore { ... }` block, add the field beside the other session-only nonces (near `northResetNonce`), with a doc comment matching the file's style:

```ts
  // Bumped by selectTrail (a user tap) to signal MapCanvas to fire the one-shot camera fit. A
  // restored selection does not bump it, so restore shows the overlay without re-fitting the
  // camera. Session-only.
  trailFitNonce: number
```

In the `create(...)` initializer (the object with `followMode: 'position'`, etc.), add:

```ts
      trailFitNonce: 0,
```

- [ ] **Step 5: Make `selectTrail` bump the nonce**

In `src/store/mapStore.ts`, change `selectTrail` from:

```ts
      selectTrail: (id) => set({ selectedTrailId: id, followMode: 'off' }),
```

to:

```ts
      selectTrail: (id) =>
        set((s) => ({ selectedTrailId: id, followMode: 'off', trailFitNonce: s.trailFitNonce + 1 })),
```

- [ ] **Step 6: Add `selectedTrailId` to `partialize`**

In `src/store/mapStore.ts`, change:

```ts
      partialize: (s) => ({ mapStyleId: s.mapStyleId }),
```

to:

```ts
      partialize: (s) => ({ mapStyleId: s.mapStyleId, selectedTrailId: s.selectedTrailId }),
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx jest src/store/__tests__/mapStore.test.ts`
Expected: PASS (all cases, including the two edited ones).

- [ ] **Step 8: Full gate**

Run: `npx tsc --noEmit && npx jest`
Expected: tsc clean; full suite green.

- [ ] **Step 9: Commit**

```bash
git add src/store/mapStore.ts src/store/__tests__/mapStore.test.ts
git commit -m "feat: persist selectedTrailId and add trailFitNonce to map store"
```

---

### Task 2: Wire restore into the map UI (fit-on-nonce + self-heal)

**Files:**
- Modify: `src/map/MapCanvas.tsx:41-47` (the trail-fit `useEffect`)
- Modify: `src/map/useSelectedTrail.ts:17-19` (the `getTrail().then(...)` callback)

**Interfaces:**
- Consumes from Task 1: `useMapStore((s) => s.trailFitNonce)`; `selectTrail` now bumps that nonce.
- Consumes existing: `useMapStore((s) => s.clearSelectedTrail)`, `boundsForPoints`, `MapTokens.cameraPadding`, `MapTokens.trailFitDurationMs`.
- Produces: no new exports. Native/effect behavior only — device-verified, not unit-tested.

- [ ] **Step 1: Drive the camera fit from the nonce in `MapCanvas`**

In `src/map/MapCanvas.tsx`, add a selector for the nonce next to the existing `northResetNonce` selector (around line 30):

```ts
  const trailFitNonce = useMapStore((s) => s.trailFitNonce)
```

Then **replace** the existing trail-fit effect (currently lines ~40-47):

```ts
  // Frame the selected trail once when it loads (follow is already off — selectTrail set it).
  useEffect(() => {
    if (!hasTrail) return
    const bounds = boundsForPoints(points)
    if (!bounds) return
    const { top, sides, bottom } = MapTokens.cameraPadding
    cameraRef.current?.fitBounds(bounds.ne, bounds.sw, [top, sides, bottom, sides], MapTokens.trailFitDurationMs)
  }, [trail])
```

with a nonce-driven version (mirrors the `northResetNonce` effect directly above it — one-shot, keyed on the nonce, guarded against the initial mount):

```ts
  // Frame the trail once per user tap. selectTrail bumps trailFitNonce; a restored selection
  // does not, so reopening the app shows the overlay without re-fitting (the camera keeps
  // following the user). Guarded on > 0 so a fresh mount never fits.
  useEffect(() => {
    if (trailFitNonce === 0) return
    if (!hasTrail) return
    const bounds = boundsForPoints(points)
    if (!bounds) return
    const { top, sides, bottom } = MapTokens.cameraPadding
    cameraRef.current?.fitBounds(bounds.ne, bounds.sw, [top, sides, bottom, sides], MapTokens.trailFitDurationMs)
  }, [trailFitNonce])
```

Leave `points`/`hasTrail` intentionally out of the deps: the nonce is bumped by the same synchronous user action that selects the trail, and the geometry has loaded by the time a nonce-driven fit runs. Adding `trail`/`points` back would reintroduce the identity-driven fit on restore. This matches the exhaustive-deps posture of the existing `northResetNonce` effect in the same file.

- [ ] **Step 2: Self-heal a deleted trail in `useSelectedTrail`**

In `src/map/useSelectedTrail.ts`, add a selector for `clearSelectedTrail` near the existing store selectors (after line ~8):

```ts
  const clearSelectedTrail = useMapStore((s) => s.clearSelectedTrail)
```

Then **replace** the existing `.then(...)` callback (currently lines ~17-19):

```ts
    trailsRepository.getTrail(selectedTrailId).then((loaded) => {
      if (active) setTrail(loaded)
    })
```

with a version that clears a stale persisted id when the trail is gone:

```ts
    trailsRepository.getTrail(selectedTrailId).then((loaded) => {
      if (!active) return
      if (loaded == null) clearSelectedTrail()
      setTrail(loaded)
    })
```

Add `clearSelectedTrail` to the effect's dependency array (the array currently `[selectedTrailId, trails]`):

```ts
  }, [selectedTrailId, trails, clearSelectedTrail])
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Full unit gate (regression)**

Run: `npx jest`
Expected: full suite green (no unit tests target these native files; this confirms nothing else broke).

- [ ] **Step 5: Device-verify on the phone**

Build/run per the project's flow (Metro already running, or `nix-shell --run "npx expo run:android"`). Verify:
1. Display a trail (tap a card) → confirm the camera fits the trail once (regression: fit still works).
2. Kill the app fully → reopen → the trail's overlay + info card are restored, and the camera is **following the user's position** (no fit animation to the trail).
3. Close with **no** trail displayed → reopen → clean map, no overlay/card.
4. With a trail displayed, delete that trail's row (delete it from the Trails list, or clear app data for a fresh DB) then restart → clean map, no crash, and the stale id is cleared (re-opening again still shows a clean map).

- [ ] **Step 6: Commit**

```bash
git add src/map/MapCanvas.tsx src/map/useSelectedTrail.ts
git commit -m "feat: restore displayed trail on launch without re-fitting the camera"
```

---

## Notes for the executor

- This slice adds **no** new files, **no** new dependencies, and **no** native/config changes — so no prebuild is required.
- Do not persist `followMode` or any camera state; the "follow me on restore" behavior depends on `followMode` defaulting to `'position'` every launch.
- The `trailFitNonce` guard (`=== 0`) is load-bearing: without it, a fresh mount (nonce 0) is fine, but any future code that sets a nonce before geometry loads would fit prematurely. Keep the guard.
