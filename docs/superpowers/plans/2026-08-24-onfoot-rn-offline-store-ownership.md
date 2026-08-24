# Offline Store Ownership Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make `offlineStore` the single owner of every offline-pack mutation and its live sync, so pack state is correct-by-construction (no per-consumer refresh convention).

**Architecture:** Store actions `init` / `download` / `resume` / `remove` / `removeForTrail` each own their controller call, progress subscription, and `packs` reload. Components become pure readers + dispatchers; one `init` runs at app root. No new port method.

**Tech Stack:** Zustand, `@rnmapbox/maps` (behind the `OfflineController` port), `@gorhom/bottom-sheet`, Expo Router, Jest.

## Global Constraints

- Single atomic task — the store API change and all consumer rewires land in ONE commit so the tree always compiles.
- Map-provider seam inviolable (SDK only in `src/map/providers/mapbox/`); store/components use the `OfflineController` port. `app/_layout.tsx` importing `mapboxProvider` is the sanctioned composition root (already so).
- Persistence unchanged: session-only store, no new table.
- Leaf-not-barrel; comments current-state-only, sparingly; two-space indent, no semicolons; no quick-fixes.
- Store logic is TDD'd; the rewired components + app-root init are device-verified (do NOT add component/screen unit tests).
- Gate: `npx tsc --noEmit` clean AND `npx jest` fully green.
- Device-verify on phone SWWC4HEIYHZPQWZX (user's manual step).

---

### Task 1: Store becomes the single offline-pack owner

**Files:**
- Rewrite: `src/map/offline/offlineStore.ts`
- Rewrite test: `src/map/offline/__tests__/offlineStore.test.ts`
- Modify: `src/map/offline/operations.ts` (remove `removeAllPacksForTrail`; keep pure `packIdsForTrail`)
- Modify test: `src/map/offline/__tests__/operations.test.ts` (drop the `removeAllPacksForTrail` test)
- Delete: `src/map/offline/download.ts`
- Modify: `src/map/offline/OfflineLayerChooser.tsx`, `src/trails/TrailInfoSheet.tsx`, `src/map/offline/OfflineMapsList.tsx`, `app/(tabs)/trails.tsx`, `app/_layout.tsx`

**Interfaces:**
- Produces (store): `useOfflineStore` with state `{ packs: OfflinePackInfo[]; progress: Record<string, LiveProgress> }` and actions `init(controller)`, `download(controller, descriptor)`, `resume(controller, id)`, `remove(controller, ids)`, `removeForTrail(controller, trailId)`. The old `refreshPacks`/`setProgress`/`clearProgress` exports and `src/map/offline/download.ts` (`runPackDownload`) are gone.
- Keeps: pure `packIdsForTrail(packs, trailId)` in `operations.ts`.

- [ ] **Step 1: Rewrite the store test (TDD — write first, watch fail)**

`src/map/offline/__tests__/offlineStore.test.ts`:
```ts
import { useOfflineStore } from '../offlineStore'
import { packId } from '../packId'
import type { OfflineController, OfflinePackInfo } from '../../provider/types'

const flush = () => new Promise((r) => setImmediate(r))

const info = (id: string, state: OfflinePackInfo['state'] = 'complete', percentage = 100): OfflinePackInfo => ({
  id, meta: null, state, percentage, sizeBytes: 1,
})

// Fake controller. `subscribe` immediately drives the provided script of progress/error calls,
// so the store's completion/error wiring runs synchronously within a flushed microtask.
function makeController(opts: {
  packs?: OfflinePackInfo[]
  onSubscribe?: (id: string, onProgress: (i: OfflinePackInfo) => void, onError: (id: string, m: string) => void) => void
} = {}): OfflineController & { deleted: string[]; downloaded: string[]; resumed: string[] } {
  const deleted: string[] = []
  const downloaded: string[] = []
  const resumed: string[] = []
  return {
    deleted, downloaded, resumed,
    downloadPack: async (d) => { downloaded.push(d.id) },
    resumePack: async (id) => { resumed.push(id) },
    deletePack: async (id) => { deleted.push(id) },
    listPacks: async () => opts.packs ?? [],
    subscribe: (id, onProgress, onError) => {
      opts.onSubscribe?.(id, onProgress, onError)
      return () => {}
    },
  }
}

beforeEach(() => useOfflineStore.setState({ packs: [], progress: {} }))

describe('offlineStore ownership', () => {
  test('init loads the registry', async () => {
    await useOfflineStore.getState().init(makeController({ packs: [info(packId(1, 'a'))] }))
    expect(useOfflineStore.getState().packs).toHaveLength(1)
  })

  test('download: optimistic progress, then completion clears progress and reloads packs', async () => {
    const controller = makeController({
      packs: [info(packId(1, 'a'))],
      onSubscribe: (id, onProgress) => onProgress(info(id, 'complete', 100)),
    })
    useOfflineStore.getState().download(controller, {
      id: packId(1, 'a'), styleUrl: 'u', bounds: [[1, 1], [0, 0]], minZoom: 10, maxZoom: 16, meta: { trailId: 1, styleId: 'a' },
    })
    await flush()
    expect(controller.downloaded).toEqual([packId(1, 'a')])
    expect(useOfflineStore.getState().progress[packId(1, 'a')]).toBeUndefined()
    expect(useOfflineStore.getState().packs).toHaveLength(1)
  })

  test('download error marks the pack failed', async () => {
    const controller = makeController({ onSubscribe: (id, _p, onError) => onError(id, 'boom') })
    useOfflineStore.getState().download(controller, {
      id: packId(1, 'a'), styleUrl: 'u', bounds: [[1, 1], [0, 0]], minZoom: 10, maxZoom: 16, meta: { trailId: 1, styleId: 'a' },
    })
    await flush()
    expect(useOfflineStore.getState().progress[packId(1, 'a')]).toEqual({ percentage: 0, failed: true })
  })

  test('resume unsticks a failed entry and completes', async () => {
    const id = packId(1, 'a')
    useOfflineStore.setState({ progress: { [id]: { percentage: 0, failed: true } } })
    const controller = makeController({ packs: [info(id)], onSubscribe: (sid, onProgress) => onProgress(info(sid, 'complete', 100)) })
    useOfflineStore.getState().resume(controller, id)
    await flush()
    expect(controller.resumed).toEqual([id])
    expect(useOfflineStore.getState().progress[id]).toBeUndefined()
  })

  test('remove deletes the given ids, clears their progress, and reloads', async () => {
    const id = packId(1, 'a')
    useOfflineStore.setState({ progress: { [id]: { percentage: 50, failed: false } } })
    const controller = makeController({ packs: [] })
    await useOfflineStore.getState().remove(controller, [id])
    expect(controller.deleted).toEqual([id])
    expect(useOfflineStore.getState().progress[id]).toBeUndefined()
    expect(useOfflineStore.getState().packs).toEqual([])
  })

  test('removeForTrail deletes only that trail\'s packs', async () => {
    const controller = makeController({ packs: [info(packId(5, 'a')), info(packId(5, 'b')), info(packId(6, 'a'))] })
    await useOfflineStore.getState().removeForTrail(controller, 5)
    expect(controller.deleted.sort()).toEqual([packId(5, 'a'), packId(5, 'b')])
  })
})
```

- [ ] **Step 2: Run the store test — verify it fails**

Run: `npx jest src/map/offline/__tests__/offlineStore.test.ts`
Expected: FAIL (new actions don't exist yet).

- [ ] **Step 3: Rewrite the store**

`src/map/offline/offlineStore.ts`:
```ts
import { create } from 'zustand'
import type { OfflineController, OfflinePackDescriptor, OfflinePackInfo } from '../provider/types'
import type { LiveProgress } from './types'
import { packIdsForTrail } from './operations'

interface OfflineStore {
  packs: OfflinePackInfo[]
  progress: Record<string, LiveProgress>
  init: (controller: OfflineController) => Promise<void>
  download: (controller: OfflineController, descriptor: OfflinePackDescriptor) => void
  resume: (controller: OfflineController, id: string) => void
  remove: (controller: OfflineController, ids: string[]) => Promise<void>
  removeForTrail: (controller: OfflineController, trailId: number) => Promise<void>
}

export const useOfflineStore = create<OfflineStore>((set, get) => {
  const setProgress = (id: string, percentage: number, failed: boolean) =>
    set((s) => ({ progress: { ...s.progress, [id]: { percentage, failed } } }))
  const clearProgress = (id: string) =>
    set((s) => {
      const next = { ...s.progress }
      delete next[id]
      return { progress: next }
    })
  const reload = async (controller: OfflineController) => {
    set({ packs: await controller.listPacks() })
  }
  // Own a pack's live sync: optimistic 0%, run the kickoff, then subscribe — ticks update
  // progress, completion clears it and reloads the registry, an error marks it failed.
  const track = (controller: OfflineController, id: string, kickoff: () => Promise<void>) => {
    setProgress(id, 0, false)
    kickoff()
      .then(() => {
        const unsub = controller.subscribe(
          id,
          (info) => {
            setProgress(id, info.percentage, false)
            if (info.state === 'complete') {
              clearProgress(id)
              reload(controller)
              unsub()
            }
          },
          () => {
            setProgress(id, 0, true)
            unsub()
          },
        )
      })
      .catch(() => setProgress(id, 0, true))
  }

  return {
    packs: [],
    progress: {},
    init: (controller) => reload(controller),
    download: (controller, descriptor) =>
      track(controller, descriptor.id, () => controller.downloadPack(descriptor)),
    resume: (controller, id) => track(controller, id, () => controller.resumePack(id)),
    remove: async (controller, ids) => {
      await Promise.all(ids.map((id) => controller.deletePack(id)))
      ids.forEach(clearProgress)
      await reload(controller)
    },
    removeForTrail: async (controller, trailId) => {
      const ids = packIdsForTrail(await controller.listPacks(), trailId)
      await get().remove(controller, ids)
    },
  }
})
```

- [ ] **Step 4: Run the store test — verify it passes**

Run: `npx jest src/map/offline/__tests__/offlineStore.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Trim `operations.ts` + its test**

In `src/map/offline/operations.ts`, delete `removeAllPacksForTrail` (and its now-unused `OfflineController` import) — keep only the pure `packIdsForTrail`:
```ts
import type { OfflinePackInfo } from '../provider/types'
import { parsePackId } from './packId'

export function packIdsForTrail(packs: OfflinePackInfo[], trailId: number): string[] {
  return packs.filter((p) => parsePackId(p.id)?.trailId === trailId).map((p) => p.id)
}
```
In `src/map/offline/__tests__/operations.test.ts`, remove the `describe('removeAllPacksForTrail', …)` block and any now-unused imports (`OfflineController`); keep the `packIdsForTrail` test.

- [ ] **Step 6: Delete the old helper**

```bash
git rm src/map/offline/download.ts
```

- [ ] **Step 7: Rewire `OfflineLayerChooser.tsx`**

- Replace the `useOfflineStore` selections for `setProgress`/`clearProgress`/`refreshPacks` with the actions actually used now: `const download = useOfflineStore((s) => s.download)` and `const remove = useOfflineStore((s) => s.remove)`. Remove the `runPackDownload` import.
- Replace `startDownload` + the `run` body in `apply`:
```tsx
    const run = () => {
      adds.forEach((r) =>
        download(controller, {
          id: packId(trail.id, r.style.id),
          styleUrl: r.style.url,
          bounds: [bounds!.ne, bounds!.sw] as [[number, number], [number, number]],
          minZoom: OFFLINE_MIN_ZOOM,
          maxZoom: OFFLINE_MAX_ZOOM,
          meta: { trailId: trail.id, styleId: r.style.id },
        }),
      )
      if (removes.length) remove(controller, removes.map((r) => packId(trail.id, r.style.id)))
      ;(ref as React.RefObject<BottomSheetModal>)?.current?.dismiss()
    }
```
  Delete the standalone `startDownload` function. Ensure no unused imports remain (`refreshPacks` gone).

- [ ] **Step 8: Rewire `TrailInfoSheet.tsx`**

- Imports: drop `useEffect` (if now unused), `runPackDownload`, and the `packIdsForTrail` import if no longer needed (it isn't — see below). Replace store selections: `const download = useOfflineStore((s) => s.download)` is not needed here; use `const resume = useOfflineStore((s) => s.resume)`, `const removeForTrail = useOfflineStore((s) => s.removeForTrail)`. Keep `packs`/`progress` reads.
- Delete the mount `useEffect` that called `refreshPacks` (init now runs at app root).
- Replace the handlers:
```tsx
  const removeAll = () => {
    Alert.alert('Remove offline maps', `Remove downloaded maps for "${trail.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeForTrail(controller, trail.id) },
    ])
  }

  const retry = () => {
    packIdsForTrail(packs, trail.id).forEach((id) => resume(controller, id))
  }

  const cancel = () => removeForTrail(controller, trail.id)
```
  `retry` still needs `packIdsForTrail(packs, trail.id)` — keep that import. `removeAll`/`cancel` now use `removeForTrail`, so they no longer need `packIdsForTrail`/`clearProgress`/`refreshPacks`.

- [ ] **Step 9: Rewire `OfflineMapsList.tsx`**

- Replace `const refreshPacks = useOfflineStore((s) => s.refreshPacks)` with `const remove = useOfflineStore((s) => s.remove)`.
- The `useFocusEffect` should now only load trail names (the store stays current on its own):
```tsx
  useFocusEffect(
    useCallback(() => {
      loadTrails()
    }, [loadTrails]),
  )
```
- `removeLayer`'s onPress becomes `() => remove(controller, [packId(trailId, styleId)])` (drop the `deletePack` + `refreshPacks` pair). `controller` is still needed for `remove`.

- [ ] **Step 10: Route the trail-delete cascade through the store (`app/(tabs)/trails.tsx`)**

- Replace the import `import { removeAllPacksForTrail } from '../../src/map/offline/operations'` with `import { useOfflineStore } from '../../src/map/offline/offlineStore'`.
- Add `const removeForTrail = useOfflineStore((s) => s.removeForTrail)`.
- In `confirmDelete`'s onPress, replace `await removeAllPacksForTrail(offlineController, trail.id)` with `await removeForTrail(offlineController, trail.id)`, and swap `offlineController` for `removeForTrail` in the `useCallback` deps.

- [ ] **Step 11: Add the app-root init handler (`app/_layout.tsx`)**

Add an `OfflineInitHandler` beside the others and render it inside the hoisted `MapProviderProvider`:
```tsx
import { useEffect } from 'react'
import { useOfflineController } from '../src/map/provider'
import { useOfflineStore } from '../src/map/offline/offlineStore'

function OfflineInitHandler() {
  const controller = useOfflineController()
  const init = useOfflineStore((s) => s.init)
  useEffect(() => {
    init(controller)
  }, [init, controller])
  return null
}
```
Render `<OfflineInitHandler />` alongside `<ShareIntentHandler />` / `<ResumeRecordingHandler />` (all inside `MapProviderProvider` → `BottomSheetModalProvider`).

- [ ] **Step 12: Full gate**

Run: `npx tsc --noEmit && npx jest`
Expected: tsc clean (watch for unused imports/vars from the rewires); jest green — the offlineStore suite now reflects the new actions, operations suite trimmed, all other suites unchanged.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "refactor(offline): make offlineStore the single owner of pack mutations + sync"
```

## Self-Review

- **Single owner:** every mutation path (chooser download/remove, sheet remove/retry/cancel, Settings per-layer remove, trail-delete cascade) now goes through a store action that reloads packs; the only load points are those actions + one app-root `init`. No component calls `subscribe`/`refreshPacks`/`clearProgress`. ✓
- **Compiles at every commit:** one atomic commit. ✓
- **Seam/persistence/leaf:** store uses the port only; no new table; `packIdsForTrail` stays pure. ✓
- **Tests:** store actions TDD'd (init/download-complete/download-error/resume-unstick/remove/removeForTrail); pure helpers untouched. Components device-verified. ✓
- **Type consistency:** `download(controller, descriptor)`, `resume(controller, id)`, `remove(controller, ids)`, `removeForTrail(controller, trailId)`, `init(controller)` used identically across store + consumers. ✓
