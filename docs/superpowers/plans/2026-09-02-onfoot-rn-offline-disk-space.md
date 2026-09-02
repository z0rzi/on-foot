# Offline Download — Insufficient Disk Space Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refuse an offline map download before it starts when the device lacks enough free space for the estimated tile pack, and tell the user why.

**Architecture:** A pure decision helper (`hasEnoughDiskSpace`) plus a thin IO reader (`readFreeDiskBytes`) live in a new `diskSpace.ts`, mirroring the existing `net/gate.ts` (pure) + `net/netinfo.ts` (IO) split. The existing `guardDownload` gate gains a disk-check step between its offline and metered branches. No map-SDK involvement — disk space is read via `expo-file-system`.

**Tech Stack:** TypeScript, React Native, Expo (`expo-file-system` ~57.0.5, modern `Paths` API), Jest (`jest-expo` preset).

## Global Constraints

- `expo-file-system` free space is read via `Paths.availableDiskSpace` (synchronous byte getter, modern API). The legacy `getFreeDiskStorageAsync` is deprecated and throws at runtime — do NOT use it.
- Fail-open: any probe error (connectivity OR disk) must let the download proceed, never block it.
- The map-provider seam is inviolable — this feature must not import any map SDK. `expo-file-system` is device-level, not provider-level, so it is allowed in shared offline code.
- Pure logic is TDD'd (Jest); imperative/native shells (`guardDownload`, the IO reader, `Alert`) are device-verified, not unit-tested — follow the existing treatment of `guardDownload` / `netinfo`.
- Comments describe current state, not changes (project AGENTS.md rule).

---

### Task 1: Disk-space module (pure check + IO reader) and reserve constant

**Files:**
- Modify: `src/map/offline/constants.ts`
- Create: `src/map/offline/diskSpace.ts`
- Test: `src/map/offline/__tests__/diskSpace.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `DISK_SPACE_RESERVE_BYTES: number` (from `constants.ts`)
  - `hasEnoughDiskSpace(freeBytes: number, estimatedBytes: number): boolean` (from `diskSpace.ts`)
  - `readFreeDiskBytes(): number` (from `diskSpace.ts`)

- [ ] **Step 1: Add the reserve constant**

Append to `src/map/offline/constants.ts`:

```ts
// Headroom kept free above a download's estimated size: absorbs the roughness of the
// tile-count estimate and keeps the device off a full disk. Used by the pre-download guard.
export const DISK_SPACE_RESERVE_BYTES = 100 * 1024 * 1024
```

- [ ] **Step 2: Write the failing test**

Create `src/map/offline/__tests__/diskSpace.test.ts`:

```ts
import { hasEnoughDiskSpace } from '../diskSpace'
import { DISK_SPACE_RESERVE_BYTES } from '../constants'

describe('hasEnoughDiskSpace', () => {
  const est = 50_000_000

  test('true when free space exactly equals estimate plus the reserve', () => {
    expect(hasEnoughDiskSpace(est + DISK_SPACE_RESERVE_BYTES, est)).toBe(true)
  })

  test('false when free space is one byte short of estimate plus reserve', () => {
    expect(hasEnoughDiskSpace(est + DISK_SPACE_RESERVE_BYTES - 1, est)).toBe(false)
  })

  test('a zero-byte estimate still requires the reserve to be free', () => {
    expect(hasEnoughDiskSpace(DISK_SPACE_RESERVE_BYTES, 0)).toBe(true)
    expect(hasEnoughDiskSpace(DISK_SPACE_RESERVE_BYTES - 1, 0)).toBe(false)
  })

  test('false when a large estimate exceeds free space', () => {
    expect(hasEnoughDiskSpace(1_000_000_000, 5_000_000_000)).toBe(false)
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx jest src/map/offline/__tests__/diskSpace.test.ts`
Expected: FAIL — cannot find module `../diskSpace`.

- [ ] **Step 4: Write the module**

Create `src/map/offline/diskSpace.ts`:

```ts
import { Paths } from 'expo-file-system'
import { DISK_SPACE_RESERVE_BYTES } from './constants'

export function hasEnoughDiskSpace(freeBytes: number, estimatedBytes: number): boolean {
  return freeBytes >= estimatedBytes + DISK_SPACE_RESERVE_BYTES
}

export function readFreeDiskBytes(): number {
  return Paths.availableDiskSpace
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest src/map/offline/__tests__/diskSpace.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/map/offline/constants.ts src/map/offline/diskSpace.ts src/map/offline/__tests__/diskSpace.test.ts
git commit -m "feat(offline): disk-space check and free-space reader"
```

---

### Task 2: Wire the disk gate into guardDownload and update callers

**Files:**
- Modify: `src/map/offline/downloadConsent.ts`
- Modify: `src/map/offline/OfflineLayerChooser.tsx:100`
- Modify: `src/trails/TrailInfoSheet.tsx:67` (verify only — no code change)

**Interfaces:**
- Consumes: `hasEnoughDiskSpace`, `readFreeDiskBytes` (Task 1); `formatBytes` from `./format`; `evaluateDownloadGate`, `GateDecision` from `../../net/gate`; `getConnectivity` from `../../net/netinfo`.
- Produces: `guardDownload(estimatedBytes: number | null, proceed: () => void): Promise<void>` — signature change from `(sizeLabel: string | null, proceed)`.

This task has no new Jest test — `guardDownload` is an imperative shell over `Alert` + IO, device-verified like the rest of `downloadConsent.ts` / `netinfo.ts`. Its guards: the full suite stays green, `tsc` passes, and the on-device check in Step 5.

- [ ] **Step 1: Rewrite `guardDownload` with the disk gate**

Replace the entire contents of `src/map/offline/downloadConsent.ts` with:

```ts
import { Alert } from 'react-native'
import { getConnectivity } from '../../net/netinfo'
import { evaluateDownloadGate, type GateDecision } from '../../net/gate'
import { hasEnoughDiskSpace, readFreeDiskBytes } from './diskSpace'
import { formatBytes } from './format'

// Read connectivity once and route the download: abort when offline, block when the device
// lacks room for the estimated pack, ask for consent on mobile data, proceed otherwise.
// Fail-open — a probe error (connectivity or disk) must not block a legitimate download.
// `estimatedBytes` is the total to download when known (null on the retry path); it drives
// both the disk check and the size shown in the metered prompt.
export async function guardDownload(
  estimatedBytes: number | null,
  proceed: () => void,
): Promise<void> {
  let decision: GateDecision
  try {
    decision = evaluateDownloadGate(await getConnectivity())
  } catch {
    decision = 'ok'
  }

  if (decision === 'offline') {
    Alert.alert('You\'re offline', 'Connect to the internet to download offline maps.')
    return
  }

  if (estimatedBytes !== null) {
    let freeBytes: number | null
    try {
      freeBytes = readFreeDiskBytes()
    } catch {
      freeBytes = null
    }
    if (freeBytes !== null && !hasEnoughDiskSpace(freeBytes, estimatedBytes)) {
      Alert.alert(
        'Not enough space',
        `This download needs about ${formatBytes(estimatedBytes)}, but only ${formatBytes(freeBytes)} is free. Free up some space and try again.`,
      )
      return
    }
  }

  if (decision === 'metered') {
    const message = estimatedBytes
      ? `This download is about ${formatBytes(estimatedBytes)} and may use your mobile data. Continue?`
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

- [ ] **Step 2: Update the `OfflineLayerChooser` caller**

In `src/map/offline/OfflineLayerChooser.tsx`, change the `guardDownload` call (currently line ~100). From:

```tsx
        guardDownload(toDownloadBytes ? formatBytes(toDownloadBytes) : null, () => {
```

To:

```tsx
        guardDownload(toDownloadBytes || null, () => {
```

(`formatBytes` is still imported and used elsewhere in this file — do not remove the import.)

- [ ] **Step 3: Verify the `TrailInfoSheet` caller needs no change**

Open `src/trails/TrailInfoSheet.tsx` around line 67. Confirm the retry call is `guardDownload(null, () => { ... })`. Passing `null` skips the disk check (unknown combined size) — this is intended. No edit.

- [ ] **Step 4: Typecheck and run the full test suite**

Run: `npx tsc --noEmit`
Expected: no errors (confirms every `guardDownload` caller matches the new signature).

Run: `npx jest`
Expected: all suites pass (baseline was 56 offline/net tests; nothing should regress).

- [ ] **Step 5: Device verification**

Build/run the app. On a device (or emulator with a constrained data partition), open a trail's **Offline map** chooser, select a layer whose estimate exceeds free space, and tap **Apply**. Expected: a **"Not enough space"** alert naming required vs available size; no download starts. Then verify a normal download (ample free space) still proceeds and, on a metered connection, still shows the mobile-data prompt.

- [ ] **Step 6: Commit**

```bash
git add src/map/offline/downloadConsent.ts src/map/offline/OfflineLayerChooser.tsx
git commit -m "feat(offline): guard downloads against insufficient disk space"
```

---

## Self-Review

**Spec coverage:**
- Pre-flight check in `guardDownload` → Task 2. ✓
- New `diskSpace.ts` (pure `hasEnoughDiskSpace` + IO `readFreeDiskBytes`) → Task 1. ✓
- `DISK_SPACE_RESERVE_BYTES` = 100 MB constant → Task 1. ✓
- Signature change `sizeLabel: string | null` → `estimatedBytes: number | null` → Task 2, Step 1. ✓
- Caller updates (`OfflineLayerChooser` number; `TrailInfoSheet` unchanged `null`) → Task 2, Steps 2–3. ✓
- Gate ordering offline → disk → metered → proceed → Task 2, Step 1. ✓
- Fail-open on disk probe throw + null-size skip → Task 2, Step 1. ✓
- `hasEnoughDiskSpace` boundary tests → Task 1, Step 2. ✓
- IO reader / Alert device-verified, not unit-tested → Task 2, Step 5. ✓

**Type consistency:** `hasEnoughDiskSpace(freeBytes, estimatedBytes)` and `readFreeDiskBytes()` are defined in Task 1 and consumed with the same names/signatures in Task 2. `guardDownload(estimatedBytes: number | null, proceed)` is produced in Task 2 and matched by both callers.

**No placeholders:** every code step shows complete content.
