# Offline Maps — Connectivity Gate (NetInfo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make offline-map downloads connectivity-aware — fail fast when offline, warn before spending mobile data — via a small `src/net/` connectivity module and one shared gate at both download triggers.

**Architecture:** A new `src/net/` module splits pure decisions from the native edge: `types.ts` (the semantic `ConnectivityStatus`), `netinfo.ts` (the only NetInfo import — a pure state mapper plus an impure `getConnectivity()`), `gate.ts` (a pure `evaluateDownloadGate`), and `downloadGate.ts` (the impure `guardDownload` that reads connectivity and drives the Alert/consent flow). The chooser's Apply and the sheet's Retry both route their downloads through `guardDownload`. The old size-heuristic warning is removed — the real connection type replaces it.

**Tech Stack:** React Native, Expo SDK 57, TypeScript, Zustand, `@react-native-community/netinfo`, Jest (`jest-expo`), `@gorhom/bottom-sheet`.

## Global Constraints

- **Branch:** all work on `feat/offline-maps` (continues the offline-maps feature, pre-merge). Do not create a new branch.
- **Map-provider seam is inviolable:** only `src/map/providers/<provider>/` may import a map SDK. NetInfo is NOT a map SDK — it lives in `src/net/`, and only `src/net/netinfo.ts` may import `@react-native-community/netinfo`. No other file (store, UI, `src/net/gate.ts`, `src/net/downloadGate.ts`) imports NetInfo.
- **Persistence seam is inviolable:** only `src/data/db/*` may import `expo-sqlite`/`drizzle-orm`. This slice touches neither.
- **Pure logic is TDD'd; native/rendering is device-verified.** `toConnectivityStatus`, `evaluateDownloadGate` → Jest tests written first. `getConnectivity` (native fetch), `guardDownload` (Alert), and the two wired call sites → device-verified, not unit-tested.
- **Install the native dep with Expo:** `npx expo install @react-native-community/netinfo` (selects the SDK-57-correct version). Do NOT hand-pin a version in `package.json`.
- **Native dep needs a clean prebuild + dev-client rebuild** before it runs on device: `npx expo prebuild --clean`, then rebuild/reinstall the dev client. `tsc`/`jest` passing is NOT sufficient evidence the feature works — the wiring is device-verified offline and on cellular. Prebuild + device rebuild + on-device verification are the human's steps after the plan's tasks; the subagent tasks end at `tsc`/`jest` green.
- **Comments (AGENTS.md):** no change-narrating comments; comment only a genuinely non-obvious *why*.
- **Connectivity semantics (verbatim):** `online = isConnected && isInternetReachable !== false` (treat `null`/probing as online); `metered = type === 'cellular'`.
- **Fail-open:** if `getConnectivity()` throws, treat the decision as `'ok'` — a probe error must never block a legitimate download.
- **Removes are never gated:** removing offline data needs no network; only new downloads (adds/retries) pass through the gate.
- **Gates (run and confirm green after each task):** `npx tsc --noEmit`, `npx jest`, and the two seam greps:
  - `grep -rn "@rnmapbox" src app | grep -v "src/map/providers/"` → empty
  - `grep -rn "@react-native-community/netinfo" src app | grep -v "src/net/netinfo"` → empty

---

### Task 1: Install NetInfo + Jest mock

**Files:**
- Modify: `package.json` (dep added by `expo install`)
- Create: `__mocks__/@react-native-community/netinfo.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: the `@react-native-community/netinfo` dependency, and a Jest auto-mock so any module importing it loads under the test runner. The mock's default export exposes `fetch: jest.fn()` and `addEventListener: jest.fn(() => jest.fn())`.

- [ ] **Step 1: Install the dependency**

Run: `npx expo install @react-native-community/netinfo`
Expected: `package.json` gains `@react-native-community/netinfo` at the SDK-57-compatible version; lockfile updated.

- [ ] **Step 2: Create the Jest manual mock**

Root `__mocks__/` mocks for node_modules are applied automatically (no `jest.mock()` call needed) — this mirrors the existing `__mocks__/@rnmapbox/maps.ts`. The real package's native module isn't linked under Jest, so stub the surface the adapter uses.

Create `__mocks__/@react-native-community/netinfo.ts`:

```ts
// Manual Jest mock: the native module isn't linked under Jest. Only the surface the
// connectivity adapter uses is stubbed — extend if more is needed.
const NetInfo = {
  fetch: jest.fn(),
  addEventListener: jest.fn(() => jest.fn()),
}

export default NetInfo
```

- [ ] **Step 3: Verify the toolchain is still green**

Run: `npx tsc --noEmit && npx jest`
Expected: `tsc` clean; all existing tests pass (the mock is inert until something imports NetInfo).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json "__mocks__/@react-native-community/netinfo.ts"
git commit -m "chore(net): add @react-native-community/netinfo + jest mock"
```

(If the repo uses `yarn`/`pnpm`, stage the matching lockfile instead of `package-lock.json`.)

---

### Task 2: Connectivity types + NetInfo adapter

**Files:**
- Create: `src/net/types.ts`
- Create: `src/net/netinfo.ts`
- Test: `src/net/__tests__/netinfo.test.ts`

**Interfaces:**
- Consumes: `@react-native-community/netinfo` (only here), its `NetInfoState` type.
- Produces:
  - `src/net/types.ts`: `interface ConnectivityStatus { online: boolean; metered: boolean }`
  - `src/net/netinfo.ts`: `toConnectivityStatus(state: NetInfoState): ConnectivityStatus` (pure) and `getConnectivity(): Promise<ConnectivityStatus>` (calls `NetInfo.fetch()`).

- [ ] **Step 1: Create the types file**

Create `src/net/types.ts`:

```ts
export interface ConnectivityStatus {
  online: boolean
  metered: boolean
}
```

- [ ] **Step 2: Write the failing test for the mapper**

Create `src/net/__tests__/netinfo.test.ts`. `NetInfoState` is a wide discriminated union; construct partial objects and cast, asserting only the fields the mapper reads.

```ts
import type { NetInfoState } from '@react-native-community/netinfo'
import { toConnectivityStatus } from '../netinfo'

const state = (s: Partial<NetInfoState>) => s as NetInfoState

describe('toConnectivityStatus', () => {
  test('connected with reachable internet is online', () => {
    expect(toConnectivityStatus(state({ isConnected: true, isInternetReachable: true })).online).toBe(true)
  })
  test('connected but internet definitively unreachable is offline', () => {
    expect(toConnectivityStatus(state({ isConnected: true, isInternetReachable: false })).online).toBe(false)
  })
  test('reachability still probing (null) is treated as online', () => {
    expect(toConnectivityStatus(state({ isConnected: true, isInternetReachable: null })).online).toBe(true)
  })
  test('no connection is offline', () => {
    expect(toConnectivityStatus(state({ isConnected: false, isInternetReachable: false })).online).toBe(false)
  })
  test('cellular is metered', () => {
    expect(toConnectivityStatus(state({ type: 'cellular', isConnected: true, isInternetReachable: true })).metered).toBe(true)
  })
  test('wifi is not metered', () => {
    expect(toConnectivityStatus(state({ type: 'wifi', isConnected: true, isInternetReachable: true })).metered).toBe(false)
  })
})
```

- [ ] **Step 2b: Run the test to verify it fails**

Run: `npx jest src/net/__tests__/netinfo.test.ts`
Expected: FAIL — `../netinfo` has no `toConnectivityStatus` export yet.

- [ ] **Step 3: Implement the adapter**

Create `src/net/netinfo.ts`:

```ts
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo'
import type { ConnectivityStatus } from './types'

export function toConnectivityStatus(state: NetInfoState): ConnectivityStatus {
  return {
    online: !!state.isConnected && state.isInternetReachable !== false,
    metered: state.type === 'cellular',
  }
}

export async function getConnectivity(): Promise<ConnectivityStatus> {
  return toConnectivityStatus(await NetInfo.fetch())
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/net/__tests__/netinfo.test.ts`
Expected: PASS (all six cases).

- [ ] **Step 5: Verify gates**

Run: `npx tsc --noEmit && npx jest`
Then the NetInfo seam grep: `grep -rn "@react-native-community/netinfo" src app | grep -v "src/net/netinfo"` → must be empty.
Expected: tsc clean, all tests pass, grep empty.

- [ ] **Step 6: Commit**

```bash
git add src/net/types.ts src/net/netinfo.ts src/net/__tests__/netinfo.test.ts
git commit -m "feat(net): connectivity status type + NetInfo adapter"
```

---

### Task 3: Pure download gate

**Files:**
- Create: `src/net/gate.ts`
- Test: `src/net/__tests__/gate.test.ts`

**Interfaces:**
- Consumes: `ConnectivityStatus` from `src/net/types`.
- Produces: `type GateDecision = 'offline' | 'metered' | 'ok'` and `evaluateDownloadGate(status: ConnectivityStatus): GateDecision`, both from `src/net/gate`.

- [ ] **Step 1: Write the failing test**

Create `src/net/__tests__/gate.test.ts`:

```ts
import { evaluateDownloadGate } from '../gate'

describe('evaluateDownloadGate', () => {
  test('offline status gates as offline (even on cellular)', () => {
    expect(evaluateDownloadGate({ online: false, metered: true })).toBe('offline')
    expect(evaluateDownloadGate({ online: false, metered: false })).toBe('offline')
  })
  test('online and metered warns', () => {
    expect(evaluateDownloadGate({ online: true, metered: true })).toBe('metered')
  })
  test('online and unmetered is ok', () => {
    expect(evaluateDownloadGate({ online: true, metered: false })).toBe('ok')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/net/__tests__/gate.test.ts`
Expected: FAIL — `../gate` has no `evaluateDownloadGate` export yet.

- [ ] **Step 3: Implement the gate**

Create `src/net/gate.ts`:

```ts
import type { ConnectivityStatus } from './types'

export type GateDecision = 'offline' | 'metered' | 'ok'

export function evaluateDownloadGate(status: ConnectivityStatus): GateDecision {
  if (!status.online) return 'offline'
  if (status.metered) return 'metered'
  return 'ok'
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/net/__tests__/gate.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify gates**

Run: `npx tsc --noEmit && npx jest`
Expected: tsc clean, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/net/gate.ts src/net/__tests__/gate.test.ts
git commit -m "feat(net): pure download connectivity gate"
```

---

### Task 4: `guardDownload` — the shared consent flow

**Files:**
- Create: `src/net/downloadGate.ts`

**Interfaces:**
- Consumes: `getConnectivity` from `src/net/netinfo`, `evaluateDownloadGate` from `src/net/gate`.
- Produces: `guardDownload(sizeLabel: string | null, proceed: () => void): Promise<void>` from `src/net/downloadGate`.

**Note on shape (deliberate refinement of the spec):** the spec named this `useDownloadGate` (a hook). It needs no React state or context, so a plain async function is the honest shape — a `use`-prefixed function that uses no hooks would mislead. Callers invoke `guardDownload(...)` directly. It takes a pre-formatted `sizeLabel` (not raw bytes) so the `src/net/` module has no dependency on the map-offline formatting helpers; the chooser formats its total, retry passes `null`.

This file is impure (reads native connectivity, shows an `Alert`) and is device-verified, not unit-tested — consistent with how the codebase treats native/UI edges.

- [ ] **Step 1: Implement the guard**

Create `src/net/downloadGate.ts`:

```ts
import { Alert } from 'react-native'
import { getConnectivity } from './netinfo'
import { evaluateDownloadGate, type GateDecision } from './gate'

// Read connectivity once and route the download: abort when offline, ask for consent on
// mobile data, proceed otherwise. Fail-open — a probe error must not block a legitimate
// download. `sizeLabel` (e.g. "24 MB") is shown in the metered prompt when known.
export async function guardDownload(sizeLabel: string | null, proceed: () => void): Promise<void> {
  let decision: GateDecision
  try {
    decision = evaluateDownloadGate(await getConnectivity())
  } catch {
    decision = 'ok'
  }

  if (decision === 'offline') {
    Alert.alert('You’re offline', 'Connect to the internet to download offline maps.')
    return
  }

  if (decision === 'metered') {
    const message = sizeLabel
      ? `This download is about ${sizeLabel} and may use your mobile data. Continue?`
      : 'This download may use your mobile data. Continue?'
    Alert.alert('Mobile data', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Download', onPress: proceed },
    ])
    return
  }

  proceed()
}
```

- [ ] **Step 2: Verify gates**

Run: `npx tsc --noEmit && npx jest`
Then: `grep -rn "@react-native-community/netinfo" src app | grep -v "src/net/netinfo"` → must be empty (this file imports the gate/adapter, never NetInfo directly).
Expected: tsc clean, all tests pass, grep empty.

- [ ] **Step 3: Commit**

```bash
git add src/net/downloadGate.ts
git commit -m "feat(net): guardDownload consent flow (offline fail-fast + mobile-data warning)"
```

---

### Task 5: Gate the chooser's Apply; remove the size heuristic

**Files:**
- Modify: `src/map/offline/OfflineLayerChooser.tsx` (the `apply` function and its imports)
- Modify: `src/map/offline/constants.ts` (remove `TILE_COUNT_WARN_THRESHOLD`)

**Interfaces:**
- Consumes: `guardDownload` from `src/net/downloadGate`; existing `formatBytes` from `src/map/offline/format`, `download`/`remove` from the store, `packDescriptor`, `packId`.
- Produces: nothing new (behavior change only).

**Context:** `apply()` currently computes `adds`/`removes`, and if any add exceeds `TILE_COUNT_WARN_THRESHOLD` shows a "Large download / Download on Wi‑Fi" Alert before running. Replace that heuristic with the connectivity gate. Removes stay ungated (offline-safe). Only new downloads (adds) pass through `guardDownload`; the precise total `toDownloadBytes` (already computed in the component) supplies the size label.

- [ ] **Step 1: Remove the threshold constant**

In `src/map/offline/constants.ts`, delete the `TILE_COUNT_WARN_THRESHOLD` declaration (the size-based warning it fed is being removed). Leave all other constants (`OFFLINE_MIN_ZOOM`, `OFFLINE_MAX_ZOOM`, `OFFLINE_MARGIN_KM`, `VECTOR_BYTES_PER_TILE`, `RASTER_BYTES_PER_TILE`) untouched.

- [ ] **Step 2: Update the chooser imports**

In `src/map/offline/OfflineLayerChooser.tsx`:
- Add: `import { guardDownload } from '../../net/downloadGate'`
- In the existing `./constants` import, remove `TILE_COUNT_WARN_THRESHOLD` (keep `OFFLINE_MARGIN_KM`, `OFFLINE_MIN_ZOOM`, `OFFLINE_MAX_ZOOM`).
- Keep the `formatBytes` import (still used to render per-layer/actual sizes).

- [ ] **Step 3: Rewrite `apply`**

Replace the current `apply` function body with:

```ts
    const apply = () => {
      if (!bounds) {
        Alert.alert('Cannot download', 'This trail has no route to cover.')
        return
      }
      const adds = rows.filter((r) => selected.has(r.style.id) && !r.downloaded)
      const removes = rows.filter((r) => !selected.has(r.style.id) && r.downloaded)

      // Removes need no network — run them regardless of connectivity.
      if (removes.length) {
        remove(controller, removes.map((r) => packId(trail.id, r.style.id))).then(() =>
          showToast('Offline map updated'),
        )
      }

      const dismiss = () => (ref as React.RefObject<BottomSheetModal>)?.current?.dismiss()

      if (adds.length) {
        guardDownload(toDownloadBytes ? formatBytes(toDownloadBytes) : null, () => {
          adds.forEach((r) => download(controller, packDescriptor(trail.id, r.style, bounds)))
          dismiss()
        })
      } else {
        dismiss()
      }
    }
```

Notes for the implementer:
- Remove the old `big` variable and the `Alert.alert('Large download', …)` branch entirely — `guardDownload` replaces them.
- `apply` no longer needs to be `async` (no `await` remains); the `Pressable`'s `onPress={apply}` is unchanged.
- `toDownloadBytes` is the existing component-level sum of add estimates; leave its computation as-is.

- [ ] **Step 4: Verify gates**

Run: `npx tsc --noEmit && npx jest`
Then confirm `TILE_COUNT_WARN_THRESHOLD` is fully gone: `grep -rn "TILE_COUNT_WARN_THRESHOLD" src` → must be empty.
Expected: tsc clean (no unused-import or missing-symbol errors), all tests pass, grep empty.

- [ ] **Step 5: Commit**

```bash
git add src/map/offline/OfflineLayerChooser.tsx src/map/offline/constants.ts
git commit -m "feat(offline): gate chooser downloads on connectivity; drop size heuristic"
```

---

### Task 6: Gate the sheet's Retry

**Files:**
- Modify: `src/trails/TrailInfoSheet.tsx` (the `retry` function and its imports)

**Interfaces:**
- Consumes: `guardDownload` from `src/net/downloadGate`; existing `retryTargetsForTrail`, `boundsForTrail`, `packDescriptor`, store `download`/`resume`.
- Produces: nothing new (behavior change only).

**Context:** `retry()` currently computes bounds and, for each retry target, resumes an existing pack or re-issues the download. Wrap that body in `guardDownload(null, …)` — a precise byte figure is misleading for partial-resume, so pass `null` (generic mobile-data wording).

- [ ] **Step 1: Add the import**

In `src/trails/TrailInfoSheet.tsx`, add: `import { guardDownload } from '../net/downloadGate'`.

- [ ] **Step 2: Wrap the retry body in the gate**

Replace the current `retry` function with:

```ts
  const retry = () => {
    const bounds = boundsForTrail(trail.geometry.points, OFFLINE_MARGIN_KM)
    guardDownload(null, () => {
      retryTargetsForTrail(packs, progress, trail.id).forEach((t) => {
        if (t.hasPack) {
          resume(controller, t.id)
          return
        }
        const style = caps.styles.find((s) => s.id === t.styleId)
        if (style && bounds) download(controller, packDescriptor(trail.id, style, bounds))
      })
    })
  }
```

- [ ] **Step 3: Verify gates**

Run: `npx tsc --noEmit && npx jest`
Then both seam greps:
- `grep -rn "@rnmapbox" src app | grep -v "src/map/providers/"` → empty
- `grep -rn "@react-native-community/netinfo" src app | grep -v "src/net/netinfo"` → empty
Expected: tsc clean, all tests pass, both greps empty.

- [ ] **Step 4: Commit**

```bash
git add src/trails/TrailInfoSheet.tsx
git commit -m "feat(offline): gate retry downloads on connectivity"
```

---

## Final verification (human / device)

After all tasks pass `tsc`/`jest`, the native dependency must be built into the dev client before the feature runs:

1. `npx expo prebuild --clean`
2. Rebuild + reinstall the dev client on the device (e.g. `npx expo run:android`).
3. Device-verify (per spec):
   - **Offline (airplane mode):** chooser Apply and sheet Retry both abort with the "You're offline" alert; no pack is created; nothing sticks at 0%.
   - **On cellular:** Apply (with a size in the prompt) and Retry (generic wording) show the mobile-data confirm; Cancel aborts, Download proceeds.
   - **On Wi-Fi:** Apply and Retry download with no warning.
   - **Removes-only Apply while offline:** still removes the unticked layer (not gated).
```
