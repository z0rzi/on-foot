# Offline Maps — Connectivity Gate (NetInfo) Design

**Date:** 2026-08-26
**Branch:** `feat/offline-maps` (continues the offline-maps feature, pre-merge)
**Status:** Approved — ready for implementation plan

## Goal

Make offline-map downloads connectivity-aware, as one cohesive unit:

1. **Fail-fast when offline.** A download triggered with no real internet must abort
   immediately with a clear message — never kick off a Mapbox pack that hangs at 0%
   forever. This is the root-cause fix for the "download stuck at 0%" bug.
2. **Warn on mobile data.** When the device is on a cellular (metered) connection, tell
   the user how much the download will cost and get explicit consent before spending it.

Both behaviors share one connectivity signal and one gate, applied at every download
trigger.

## Background

The offline-maps feature downloads map tiles per `(trail × layer)` pack. Downloads are
triggered from exactly two places today:

- `OfflineLayerChooser.apply()` — the chooser's **Apply** button (fresh downloads of the
  ticked-but-not-yet-downloaded layers; may also remove unticked layers).
- `TrailInfoSheet.retry()` — the sheet's **Retry download** action for failed/incomplete
  layers (resumes a partial pack, or re-issues a phantom failure).

Neither has any awareness of the network. Two consequences:

- **Offline hang:** triggering a download with no internet leaves the pack stuck at 0%
  indefinitely (Mapbox's `createPack` neither completes nor errors promptly).
- **Silent data spend:** a download over cellular can consume mobile data with no warning.
  The chooser has a `TILE_COUNT_WARN_THRESHOLD` size-heuristic alert ("…is about X MB.
  Download on Wi-Fi to avoid using mobile data.") — but this is a *guess based on size*,
  a proxy for "you might be burning mobile data." With NetInfo we can answer that
  directly, so the heuristic is replaced by a real connection-type check.

`@react-native-community/netinfo` is a native module. It is **not** a map SDK, so it does
not belong behind the map-provider seam (`src/map/providers/<provider>/`). It gets its own
small, self-contained connectivity module under `src/net/`, following the same discipline:
the native import is isolated to one adapter file, and all decision logic is pure and
unit-tested.

## Architecture

A new `src/net/` module with a clean split between pure decisions and the impure native
edge.

### `src/net/types.ts`

```ts
export interface ConnectivityStatus {
  online: boolean   // has a network AND that network reaches the internet
  metered: boolean  // connection is cellular (mobile data)
}
```

### `src/net/netinfo.ts` — the only file importing NetInfo

```ts
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo'
import type { ConnectivityStatus } from './types'

// Pure: map a NetInfo state to our semantic status. `isInternetReachable` is null while
// NetInfo probes — treat null as reachable so a slow probe never blocks a legitimate
// download; only a definitive false counts as offline.
export function toConnectivityStatus(state: NetInfoState): ConnectivityStatus {
  return {
    online: !!state.isConnected && state.isInternetReachable !== false,
    metered: state.type === 'cellular',
  }
}

// Impure edge: read the current connectivity once.
export async function getConnectivity(): Promise<ConnectivityStatus> {
  return toConnectivityStatus(await NetInfo.fetch())
}
```

### `src/net/gate.ts` — pure decision

```ts
import type { ConnectivityStatus } from './types'

export type GateDecision = 'offline' | 'metered' | 'ok'

export function evaluateDownloadGate(status: ConnectivityStatus): GateDecision {
  if (!status.online) return 'offline'
  if (status.metered) return 'metered'
  return 'ok'
}
```

### `src/net/useDownloadGate.ts` — the impure orchestration hook

Returns a single async `guard` function that both call sites use. It reads connectivity,
evaluates the pure gate, and drives the user-facing outcome:

```ts
// guard(estimatedBytes, proceed):
//   offline → Alert "You're offline" / "Connect to the internet to download offline
//             maps." — abort (proceed is NOT called).
//   metered → Alert "Mobile data" / message(estimatedBytes) with [Cancel] and
//             [Download → proceed].
//   ok      → proceed() immediately.
```

- `estimatedBytes: number | null` — when a precise total is known (the chooser), the
  metered message names it: *"This download is about 24 MB and may use your mobile
  data. Continue?"*. When `null` (retry, where partial-resume makes a byte figure
  misleading), the message is generic: *"This download may use your mobile data.
  Continue?"*.
- `proceed: () => void` — the caller's existing "kick off the downloads" closure.

Only `netinfo.ts` (adapter) and `useDownloadGate.ts` (Alert wiring) touch impure edges;
`gate.ts` and `toConnectivityStatus` are pure.

## Wiring the two triggers

One shared gate, both call sites.

### `OfflineLayerChooser.apply()`

- Compute `adds` (ticked, not downloaded) and `removes` (unticked, downloaded) as today.
- **Removes are never gated** — removing offline data needs no network and the store's
  `remove` is already offline-tolerant. Run removes as they run today.
- **Adds are gated.** When `adds.length > 0`, call `guard(toDownloadBytes, run)` where
  `run` issues the `download(...)` calls and dismisses the sheet. When there are no adds
  (removes-only Apply), skip the gate entirely.
- **Delete** `TILE_COUNT_WARN_THRESHOLD` and the old "Large download / Download on Wi-Fi"
  Alert. The connectivity gate supersedes it (Option A).

### `TrailInfoSheet.retry()`

- Wrap the existing retry body (the `retryTargetsForTrail(...).forEach(...)` loop that
  resumes or re-downloads) in `guard(null, proceed)`. Generic metered wording, since
  resumed partials make a precise byte estimate misleading.

### Size estimation

`estimate.ts` (`estimatePackSize`, per-layer + running-total display in the chooser) is
**unchanged and stays** — the chooser still shows per-layer and total sizes. Only the
*threshold-based warning* is removed; the total-bytes figure now also feeds the metered
message.

## Data flow

```
User taps Apply / Retry
      │
      ▼
guard(estimatedBytes, proceed)
      │
      ├─ getConnectivity()            (netinfo.ts → NetInfo.fetch)
      │        │
      │        ▼
      │   toConnectivityStatus(state) (pure)
      │        │
      │        ▼
      │   evaluateDownloadGate(status) (pure)
      │        │
      ├── 'offline' → Alert, abort
      ├── 'metered' → Alert confirm → proceed() | cancel
      └── 'ok'      → proceed()
                          │
                          ▼
                offlineStore.download / resume  (unchanged)
```

## Error handling & failure modes

- **Offline (airplane mode, no signal, captive portal / "connected, no internet"):**
  `evaluateDownloadGate` → `offline`; the download never starts; the user sees a clear
  Alert. Fixes the stuck-at-0% bug at its root.
- **On cellular:** informed consent before any mobile-data spend.
- **`getConnectivity()` itself throwing:** unexpected for `NetInfo.fetch()`, but the gate
  must not swallow the download silently. Treat a fetch failure as `ok` (fail-open — do
  not block a legitimate download because the probe errored); the existing offline
  hang/error paths remain the backstop. (The plan specifies the exact try/catch.)
- **Connection drops mid-download:** out of scope (see non-goals). Mapbox's error callback
  fires → the pack enters the existing `failed` state → the existing failed badge + Retry
  path handles it; the user can also Cancel.

## Native dependency & build

- Install with `npx expo install @react-native-community/netinfo` so the version matching
  Expo SDK 57 is selected (do not hand-pin a version in `package.json`).
- This is a native module: it requires a clean prebuild and a dev-client rebuild —
  `npx expo prebuild --clean`, then rebuild/reinstall the dev client on the device. A
  passing `tsc`/`jest` is **not** sufficient evidence the feature works; it must be
  device-verified.
- Add `__mocks__/@react-native-community/netinfo.ts` for Jest (mirroring the existing
  `__mocks__/@rnmapbox/maps.ts`) so the pure tests and any importing module load under the
  test runner.

## Testing

**Pure logic — TDD, Jest (`src/net/__tests__/`):**

- `toConnectivityStatus`:
  - `isConnected: true, isInternetReachable: true` → `online: true`
  - `isConnected: true, isInternetReachable: false` → `online: false`
  - `isConnected: true, isInternetReachable: null` (probing) → `online: true`
  - `isConnected: false` → `online: false`
  - `type: 'cellular'` → `metered: true`; `type: 'wifi'` → `metered: false`
- `evaluateDownloadGate`:
  - offline status → `'offline'`
  - online + metered → `'metered'`
  - online + not metered → `'ok'`

**Device-verified (native/rendering, offline included):**

- Offline (airplane mode): Apply and Retry both abort with the offline Alert; no pack is
  created; nothing sticks at 0%.
- On cellular: Apply and Retry show the mobile-data confirm; Cancel aborts, Download
  proceeds.
- On Wi-Fi: Apply and Retry download with no warning.
- Removes-only Apply while offline still removes (not gated).

## Non-goals / future work

- **Live mid-download connectivity monitoring** (auto-pause/resume on network change). The
  port can grow a `subscribe` later without reworking this slice.
- **Pre-flight free-space check + disk-full handling** — the "road trip across the country,
  download the satellite layer, device runs out of space" case. A real, separate concern
  (storage, not connectivity): a pre-flight available-space check against the size estimate
  and graceful handling of a mid-download disk-full error. Its own future slice.
- **3D-offline opt-in** — unrelated deferred slice.
```
