# Offline Maps — Design Spec

**Date:** 2026-08-24
**Status:** Approved (brainstorm complete) — ready for implementation plan
**Feature:** Download map tiles for offline use, managed per trail, with a multi-layer
chooser and a Settings management surface.

---

## 1. Goal

Let a hiker, while online, download a trail's map tiles so the map still renders when
they're off-grid on the hike. Downloads are **deliberate** (the user picks which layers),
**discoverable** (a Settings list shows what's installed), and **safe** (removing a layer
never leaves a trail half-covered).

## 2. Core model — the trail is the atomic offline unit

The pivotal decision. The user never manages a raw geographic region. They manage
**"this trail is available offline."** Underneath, a trail download *is* a Mapbox offline
pack, but sized to the trail and **1:1 with (trail × layer)** — so it is never something
that can be partially dismantled.

- **A trail maps to exactly one pack per layer — never multiple.** Nothing to reconcile.
- **No geographic partial coverage is possible.** A trail's pack always covers the whole
  trail (its bounding box); removal is all-or-nothing for that (trail × layer). The
  "download 2 packs, remove 1, half the trail dies" failure is structurally impossible.
- **The only allowed partial-ness is per-layer, and it is safe:** dropping the huge
  Satellite layer while keeping Outdoors never leaves a *geographic* hole — each layer is
  an independent complete copy of the whole trail.
- **Tile dedup is automatic and invisible.** Two overlapping trails share tiles on disk via
  Mapbox's reference-counted store; deleting one pack frees only tiles no remaining pack
  needs (confirmed: `offlineManager.deletePack` "frees resources no longer required by any
  remaining pack"). The user never sees or manages this.

### Two user mentalities
- **Trail-thinker (v1):** "I'm hiking *this trail*, make it offline." Fully served.
- **Area-thinker ("download this whole mountain"):** a **deferred** feature. It becomes a
  second, equal-peer entry type in the same Settings list. v1 leaves room for it (see §8).

## 3. UX (approved via visual mockups)

### 3.1 Trail sheet — the entry point
The existing trail bottom sheet gains:
- **A state badge next to the trail title**, determinate (never a forever-pulse):
  - `none` — no badge.
  - `downloading` — `⬇ 46%` badge; the summary line ("7.2 km · 620 m gain") is replaced by
    "Downloading <layer> · 46%" (the layer name, or "N layers" when several download at once) + a
    thin determinate progress bar; reverts when done. (A downloaded/total-MB figure is omitted —
    the native SDK gives no reliable pre-download total, only a heuristic estimate.)
  - `available` — a settled `✓ Offline` badge (static, no animation).
  - `failed` — `⚠ Failed` badge; summary shows "Download stopped · tap to retry".
- **Offline actions live in the sheet's ⋮ overflow menu** (top-right), keeping the collapsed
  sheet clean. Menu contents depend on state:
  - not offline → "Download for offline"
  - offline → "Edit offline layers", "Manage offline maps" (→ Settings), "Remove offline maps"

### 3.2 The layer chooser (one chooser, two jobs)
Tapping "Download for offline" **or** "Edit offline layers" opens the **same** chooser:
- **Layers are equal peers** — a list of rows, each with a swatch, name, per-layer size, and
  a checkbox. No "vector default + satellite extra." New sources (topo, winter, third-party)
  append as rows later.
- **First download:** the **currently-viewed layer is pre-ticked** (Outdoors in the common
  case); everything else is unticked. Deliberate.
- **Editing:** downloaded layers show ticked with "✓ Downloaded · 45 MB"; ticking a new one
  shows "Will download · ~375 MB"; unticking a downloaded one removes it on Apply.
- **Sizes:** each row shows an estimate (Satellite flagged in amber for its large size); a
  running total updates as rows toggle. Estimates are heuristic (see §5); downloaded layers
  show their actual on-disk size.
- **Zoom range is fixed** to a sensible hiking default (≈ z10–16) — not a user knob.
- Confirm button: "Download" (first) / "Apply" (edit).

### 3.3 Settings → Offline maps (source of truth)
- **Total storage used** at the top + a breakdown bar (so Satellite's footprint is obvious
  and reclaimable).
- **Trails** section — grouped by **trail name** (not by bounding box), each group showing
  per-layer rows (Outdoors 45 MB, Satellite 375 MB) with an individual remove control.
- **Areas — LATER** — a greyed "＋ Download a custom area" placeholder marking where the
  deferred area-thinker feature slots in as an equal peer. Not functional in v1.

## 4. Architecture

### 4.1 Provider seam (inviolable)
Only `src/map/providers/mapbox/` imports `@rnmapbox/maps` `offlineManager`. Shared code
talks to a new **semantic `OfflineController`** on the port (`src/map/provider/types.ts`),
mirroring `CameraController`. SDK-neutral surface:

```ts
export interface OfflinePackDescriptor {
  id: string            // deterministic: `offline:<trailId>:<styleId>` (canonical trail/style)
  bounds: [ [number, number], [number, number] ] // [ne, sw] lng/lat
  styleUrl: string
  minZoom: number
  maxZoom: number
}

export interface OfflinePackInfo {
  id: string            // parse with parsePackId for trail/style — no redundant metadata copy
  state: 'complete' | 'downloading' | 'incomplete' | 'error'
  percentage: number    // 0..100
  sizeBytes: number      // completed tile size on disk
}

export interface OfflineController {
  downloadPack(d: OfflinePackDescriptor): Promise<void>
  deletePack(id: string): Promise<void>
  resumePack(id: string): Promise<void>
  listPacks(): Promise<OfflinePackInfo[]>
  subscribe(id: string, onProgress: (p: OfflinePackInfo) => void,
            onError: (id: string, message: string) => void): () => void // returns unsubscribe
}
```

The `MapCapabilities.offline: boolean` flag already exists and is `true` for Mapbox. New
provider-specific concepts (pack state mapping, the platform size-field/percentage differences)
live in the adapter, never leaked into shared code. MapLibre stays reachable — it has an
equivalent offline API.

The Mapbox adapter maps this onto `offlineManager.createPack({ name, styleURL, bounds,
minZoom, maxZoom, metadata }, progressListener, errorListener)`, `getPacks()`,
`deletePack(name)`, `pack.resume()`, and the progress/error listeners. `pack.status().state`
(a numeric enum) maps to the neutral `state` union.

### 4.2 State model — no new persistence
The Mapbox pack registry **is** the source of truth. We persist **nothing new** in our
SQLite DB (the slice-2 "don't mirror authoritative state" lesson). Everything the UI shows is
**derived from `listPacks()`** joined with trail data:
- The pack id (`offline:<trailId>:<styleId>`) is the canonical source of the trail/style it belongs
  to — consumers parse it with `parsePackId`, so no separate metadata copy is carried.
- The Settings list, per-trail badges, and totals are all computed from the pack list.

**Live download progress** is transient and lives in a **session-only** zustand store
(`src/map/offline/offlineStore.ts`), keyed by pack id — never persisted.

### 4.3 Domain module `src/map/offline/`
Provider-agnostic. Pure logic is TDD'd:
- `packId(trailId, styleId): string` and its inverse `parsePackId(id)` — encode/decode.
- `boundsForTrail(geometry: [number,number][], marginKm: number): [ne, sw]` — bbox + margin.
- `estimatePackSize(bounds, minZoom, maxZoom, layerKind: 'vector' | 'raster'): { bytes: number; tileCount: number }`
  — heuristic; raster (satellite) uses a larger per-tile constant than vector.
- `groupPacksByTrail(packs: OfflinePackInfo[], trails: TrailSummary[]): OfflineTrailGroup[]`
  — the Settings view-model (trail name, per-layer rows, per-group + grand totals; packs
  whose trail is missing group under an "Unknown trail" bucket).
- `offlineStateForTrail(trailId, packs, progress): OfflineBadgeState` —
  `none | { kind:'downloading'; pct } | { kind:'available'; styleIds } | { kind:'failed' }`.

Type imports follow the **leaf-not-barrel** rule: pure files import `TrailSummary`/`Trail`
from `../../data/trails/types`, never the DB-opening barrel.

### 4.4 Flows
- **Download:** chooser confirm → for each ticked layer, build an `OfflinePackDescriptor`
  (bounds from the trail geometry, that layer's `styleUrl`, fixed zoom range) → `downloadPack`
  → subscribe, pushing progress into `offlineStore` → badge reacts.
- **Edit:** diff the new tick-set against existing packs → `downloadPack` for added,
  `deletePack` for removed.
- **Remove (Settings or sheet):** `deletePack` per layer (or all layers of a trail).
- **Retry (failed):** `resumePack`.
- **Cascade:** `deleteTrail` also deletes that trail's packs (no orphans).

## 5. Estimates, limits, and network

- **Size estimates are heuristic** — there is no pre-download size API in rnmapbox. Estimate
  from tile count for the bbox × zoom range × an average bytes-per-tile constant (larger for
  raster/satellite). UI labels these as estimates ("~45 MB"); actual size replaces the
  estimate once downloaded (from `completedTileSize`).
- **Tile-count limit:** Mapbox enforces a default per-device offline tile limit (6000 under
  the standard ToS). The estimate also yields a tile count; if a requested pack would exceed
  a safe threshold, warn the user (Satellite at high zoom over a large bbox is the risk case).
- **Cellular:** a per-download metered-connection warning is **deferred to a follow-up** (§8) —
  it needs a native connectivity dependency (NetInfo/expo-network) not worth adding for v1. The
  size/tile-limit warning above is the real guard against large (satellite) downloads and ships
  in v1; hikers typically grab packs on WiFi at home regardless.

## 6. Error handling
- Download error (dropped connection) → `error` state → `⚠ Failed` badge + tap-to-retry
  (`resumePack`). No forever-spinner.
- Storage full / tile-limit exceeded → surfaced as an `Alert`, download not left dangling.
- Orphaned packs (trail deleted out-of-band, e.g. an old build) → grouped under "Unknown
  trail" in Settings with a remove control; normal deletes cascade so this is an edge case.

## 7. Testing (per AGENTS.md)
- **Jest / TDD (pure logic):** `packId`/`parsePackId`, `boundsForTrail`, `estimatePackSize`,
  `groupPacksByTrail`, `offlineStateForTrail`.
- **Device-verified (not unit-tested):** actual download + live progress, cancel/remove,
  retry after a forced network drop, the layer chooser sheet, the Settings screen, the
  size/tile-limit warning. Verified on phone SWWC4HEIYHZPQWZX.

## 8. Scope

**In v1:**
- Trail-atomic offline downloads (bounding box + margin, fixed zoom range).
- Multi-layer chooser (deliberate, current layer pre-ticked, per-layer size + running total).
- Per-layer remove; Settings → Offline maps list grouped by trail; total storage + breakdown.
- Cascade delete on trail removal; size/tile-limit warning; retry.

**Deferred (design leaves room, do NOT build now):**
- **Download-an-area** (the greyed "Areas" section). When built, it becomes a second entry
  kind; model the offline entry as a tagged union `{ kind:'trail' } | { kind:'area' }`, and at
  that point badges become **coverage-derived** (is the trail's bbox fully covered by present
  tiles?) rather than "does a trail-pack exist."
- Extra non-Mapbox layer sources (topo, winter, third-party) — chooser already treats layers
  as equal peers.
- A per-download cellular/metered-connection warning, and a persistent "WiFi only" setting
  (both need a native connectivity dependency; v1 ships the size/tile-limit warning only).
- Tile staleness / auto-update (`invalidatePack` exists for a later pass).

## 9. Key constraints carried from the codebase
- **Map-provider seam inviolable** — only the mapbox adapter imports the SDK; everything else
  uses the `OfflineController` port.
- **Persist the minimum** — no new SQLite table; derive from the pack registry; progress is
  session-only.
- **Leaf-not-barrel** type imports in pure/offline code.
- **Pure logic TDD, native device-verified.**
- **No quick-fixes; comments describe current state only.**
