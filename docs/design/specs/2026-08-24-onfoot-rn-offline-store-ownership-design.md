# Offline Store Ownership Refactor — Design Spec

**Date:** 2026-08-24
**Status:** Approved (design agreed in-session) — ready for plan
**Follows:** the offline-maps feature (`2026-08-24-onfoot-rn-offline-maps-design.md`), same branch `feat/offline-maps`, pre-merge.

## 1. Why

The whole-branch review of offline-maps found that 3 of its 4 real defects (badge priority,
cold-start badge, broken retry) shared one root cause: **pack state was kept in sync with the
authoritative Mapbox registry by *convention*, not by *construction*.** The session store caches
`packs`/`progress`, but no single owner keeps it fresh — ~5 consumer sites each had to remember to
call `refreshPacks`/`subscribe`/`clearProgress`, and the ones that forgot became the bugs. This
repeats the project's own hard-won lesson (recording slices, AGENTS.md): *an invariant encoded as
convention will drift — prefer correct-by-construction.*

The post-review fixes are correct but re-assert the convention (mount-effect refresh, retry via a
shared helper). The next offline consumers — the deferred **download-an-area** and
**coverage-derived badges** — will sit on this exact seam. Fix the ownership model now, before that.

## 2. What changes

**The `offlineStore` becomes the single owner of all pack mutations and their live sync.** Every
write to the Mapbox registry goes through a store action that also owns the progress subscription
and the resulting `packs` reload. Components become pure readers + action dispatchers — they never
call `subscribe`, `refreshPacks`, or `clearProgress` directly, and no component orchestrates
freshness.

rnmapbox exposes only per-pack `subscribe` (no global listener), so "single owner" = the store owns
the subscribe lifecycle inside its mutation actions, plus one `init` load at app root. No new
`OfflineController` port method is needed.

### New store shape
```ts
interface OfflineStore {
  packs: OfflinePackInfo[]
  progress: Record<string, LiveProgress>
  // Load the current registry once (app-root, after DB migrations). Idempotent.
  init: (controller: OfflineController) => Promise<void>
  // Start a new pack download: optimistic progress, subscribe, on complete reload packs.
  download: (controller: OfflineController, descriptor: OfflinePackDescriptor) => void
  // Resume/retry an existing pack id: unsticks a failed entry, subscribes, reloads on complete.
  resume: (controller: OfflineController, id: string) => void
  // Delete packs by explicit id, clear their progress, reload packs (Settings per-layer remove).
  remove: (controller: OfflineController, ids: string[]) => Promise<void>
  // Delete every pack of a trail (whole-trail remove + the trail-delete cascade), then reload.
  removeForTrail: (controller: OfflineController, trailId: number) => Promise<void>
}
```

`removeForTrail` lists the registry, filters via the pure `packIdsForTrail`, deletes each, clears
their progress, and reloads. Routing the trail-delete cascade through it (instead of the controller
directly) is what lets the store stay authoritative and lets Settings drop its focus-refresh.
`download`/`resume` share one internal subscription helper (setProgress ticks; on `complete` →
clear progress + reload packs + unsubscribe; on error → mark failed + unsubscribe; on kickoff
rejection → mark failed). The old exported `setProgress`/`clearProgress`/`refreshPacks` and the
standalone `src/map/offline/download.ts` (`runPackDownload`) are removed — their behaviour is
absorbed into the store.

### Consumers (become readers + dispatchers)
- **`src/map/offline/download.ts`** — deleted.
- **`OfflineLayerChooser`** — `apply` calls `store.download(controller, descriptor)` per added
  layer and `store.remove(controller, removedIds)`; drops `refreshPacks`/`setProgress` usage.
- **`TrailInfoSheet`** — drops the mount `useEffect` (init now happens at root);
  `removeAll`/`cancel` → `store.removeForTrail(controller, trail.id)`; `retry` →
  `ids.forEach(id => store.resume(controller, id))`. Still reads `packs`/`progress` for the badge.
- **`OfflineMapsList`** — `removeLayer` → `store.remove(controller, [id])`; drops the
  `useFocusEffect` pack-refresh (the store is now always current); keeps `loadTrails` for names.
- **`app/(tabs)/trails.tsx`** — the trail-delete cascade calls `store.removeForTrail(controller,
  trail.id)` instead of `removeAllPacksForTrail(...)`, so the cascade goes through the store and
  leaves it fresh. `src/map/offline/operations.ts`'s `removeAllPacksForTrail` is removed (folded
  into the store); the pure `packIdsForTrail` stays (used by the store).
- **App root (`app/_layout.tsx`)** — a new `OfflineInitHandler` (mirroring `ShareIntentHandler`)
  calls `store.init(controller)` once, inside the hoisted `MapProviderProvider`.

## 3. What does NOT change

- The `OfflineController` port and the mapbox adapter (already correct incl. the Android
  string-state / resource-size / idempotent-download fixes).
- Every pure helper: `packId`/`parsePackId`, `boundsForTrail`, `estimatePackSize`,
  `groupPacksByTrail`, `offlineStateForTrail` — untouched; their tests stay green.
- The trail-atomic model, the map-provider seam, the no-new-DB-table decision, all UX.

## 4. Testing

- The store's `init`/`download`/`resume`/`remove` are now plain logic over a mockable
  `OfflineController` (a fake whose `subscribe` synchronously drives onProgress/complete/error) —
  **TDD'd**, adding coverage exactly where the convention-based bugs lived (retry unsticks a failed
  entry; download reloads packs on complete; remove clears progress + reloads).
- The rewired components + app-root init are **device-verified** (native), not unit-tested.

## 5. Constraints (carried)

- Map-provider seam inviolable; persistence unchanged (session-only store, no new table).
- Leaf-not-barrel; comments current-state-only; two-space indent, no semicolons; no quick-fixes.
- Device-verify on phone SWWC4HEIYHZPQWZX (user's manual step).

## 6. Scope

**In:** the store-ownership refactor above. **Out (unchanged deferrals):** download-an-area,
coverage-derived badges, cellular warning, extra layer sources, WiFi-only setting, tile staleness.
