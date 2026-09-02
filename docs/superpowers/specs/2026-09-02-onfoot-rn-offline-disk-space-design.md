# Offline map download — insufficient disk space guard

## Problem

Downloading an offline map writes a tile pack to device storage. On a device that
is low on space the download fails partway through, surfacing only as a generic
"failed" badge with no explanation and no guidance. The user cannot tell that the
cause is a full disk, nor that freeing space would fix it.

## Goal

Refuse a download **before it starts** when the device does not have enough free
space to hold the estimated pack, and tell the user why. Keep the check
provider-agnostic — disk space is a device concern, not a map-SDK concern.

## Non-goals (YAGNI)

- No reactive mid-download disk-full handling (interpreting native error strings is
  fragile and reaches into the provider seam).
- No per-layer disk breakdown in the UI.
- No disk check on the retry path, where no combined size estimate is computed.

## Approach

A proactive pre-flight check folded into the existing `guardDownload` gate
(`src/map/offline/downloadConsent.ts`) — the single chokepoint both download entry
points already pass through (`OfflineLayerChooser`, `TrailInfoSheet`). It already
sequences the connectivity/metered gates; the disk check is one more gate in that
sequence.

Free disk space is read via `expo-file-system` (`Paths.availableDiskSpace`, a
synchronous byte getter in the modern API). The map SDK is never involved, so the
provider seam is untouched.

## Components

Mirrors the existing `net/gate.ts` (pure decision) + `net/netinfo.ts` (IO probe)
split, so the pure logic is unit-testable and the platform import stays isolated.

### New module — `src/map/offline/diskSpace.ts`

- `hasEnoughDiskSpace(freeBytes: number, estimatedBytes: number): boolean` — pure,
  TDD'd. Rule: `freeBytes >= estimatedBytes + DISK_SPACE_RESERVE_BYTES`.
- `readFreeDiskBytes(): number` — thin IO reader returning
  `Paths.availableDiskSpace`. Not unit-tested; device-verified. The only place
  `expo-file-system` is imported for this feature.

### New constant — `src/map/offline/constants.ts`

- `DISK_SPACE_RESERVE_BYTES = 100 * 1024 * 1024` (100 MB). A headroom buffer that
  absorbs the roughness of the tile-count size estimate and keeps the OS from being
  driven to near-zero free space.

### Changed — `src/map/offline/downloadConsent.ts`

`guardDownload` signature changes:

```
guardDownload(sizeLabel: string | null, proceed: () => void)
  →
guardDownload(estimatedBytes: number | null, proceed: () => void)
```

It formats the human label internally via `formatBytes`, removing that concern from
callers. New gate ordering:

1. **offline** → alert, abort (unchanged).
2. **disk** (new) → only when `estimatedBytes` is non-null. Read free disk; if
   `!hasEnoughDiskSpace(free, estimatedBytes)`, alert `'Not enough space'` naming
   required vs available size, and abort.
3. **metered** → consent prompt (unchanged); runs after the disk check so we never
   ask about mobile data for a download that cannot fit.
4. **proceed**.

### Changed callers

- `OfflineLayerChooser.tsx` — already computes `toDownloadBytes` as a number; drop
  its `formatBytes(...)` wrap and pass the number (or `null` when zero).
- `TrailInfoSheet.tsx` — retry path keeps passing `null` (unknown combined size), so
  the disk check is skipped there.

## Error handling / fail-open

If `readFreeDiskBytes()` throws, `guardDownload` proceeds rather than blocking — the
same fail-open posture as the connectivity gate's `catch → 'ok'`. A broken probe
must never block a legitimate download.

When `estimatedBytes` is `null` (retry, unknown size) the disk gate is skipped
entirely — also fail-open.

## Data flow

```
apply() / retry()
  → guardDownload(estimatedBytes, proceed)
       ├─ decision = evaluateDownloadGate(connectivity)   (single evaluation)
       ├─ decision === 'offline'?  → alert + abort
       ├─ estimatedBytes != null?
       │     └─ readFreeDiskBytes()  (fail-open on throw)
       │           └─ hasEnoughDiskSpace(free, est)?  → no? alert + abort
       ├─ decision === 'metered'?  → consent prompt
       └─ proceed()  → store.download(...) per layer
```

## Testing

- `hasEnoughDiskSpace` — Jest, written first. Boundaries: exactly enough
  (`free == est + reserve`), one byte short, zero estimate, large estimate.
- `readFreeDiskBytes` and the `Alert` shell — device-verified, consistent with how
  `guardDownload` / `netinfo` are already treated (not unit-tested).

## Files touched

| File | Change |
| --- | --- |
| `src/map/offline/diskSpace.ts` | new — pure check + IO reader |
| `src/map/offline/__tests__/diskSpace.test.ts` | new — tests for `hasEnoughDiskSpace` |
| `src/map/offline/constants.ts` | add `DISK_SPACE_RESERVE_BYTES` |
| `src/map/offline/downloadConsent.ts` | new disk gate; signature `sizeLabel → estimatedBytes` |
| `src/map/offline/OfflineLayerChooser.tsx` | pass number instead of formatted label |
| `src/trails/TrailInfoSheet.tsx` | no behavioural change (still `null`); signature-compat only |
