# Restore Last Map State — Design

## Goal

Persist which trail is displayed on the map (or that none is) across an app
close/reopen. On the next launch, restore that trail's overlay and info card while the
camera follows the user's live position. If the persisted trail was deleted between
sessions, restore nothing and self-heal the stored state.

This is **slice 1** of the activity-recording feature (umbrella:
`2026-08-21-onfoot-rn-activity-recording-slices.md`). It is foundational: it establishes
the "displayed trail survives a restart" behavior that recording (slice 2) relies on, and
it proves the persist-across-restart path before the harder GPS work leans on it.

## Scope

- **In:** persisting `selectedTrailId`; restoring the overlay + info card on launch;
  keeping the camera in its default follow-the-user mode on restore; self-healing a
  deleted trail id.
- **Out:** anything about recording, activities, or background location (slices 2–3);
  persisting `followMode`, camera pitch, heading, or position (these stay session-only by
  design — every launch re-follows the user).

## Locked decision

**Restore-camera behavior = "follow me, trail overlaid."** On reopen with a restored
trail, show the trail overlay + info card, but keep the camera following the user's live
position (the normal launch behavior). The one-shot camera fit stays reserved for a real
user tap — a restore must not re-fit.

## Architecture

The change is confined to the map store and the two consumers that already read selection
state (`MapCanvas`, `useSelectedTrail`). No new files, no persistence-seam change (the map
store persists to AsyncStorage; trail data still comes through the `trailsRepository`
port).

### 1. Persist the minimum — add `selectedTrailId` to `partialize`

`src/store/mapStore.ts` today persists only `mapStyleId`:

```ts
partialize: (s) => ({ mapStyleId: s.mapStyleId }),
```

Extend it to also persist `selectedTrailId`:

```ts
partialize: (s) => ({ mapStyleId: s.mapStyleId, selectedTrailId: s.selectedTrailId }),
```

`selectedTrailId` is `number | null`. `null` is a real, meaningful value: it encodes "no
trail was displayed" — satisfying the requirement to "save that no trail was displayed."
`followMode` stays out of `partialize` (unchanged), so every launch defaults to
`'position'` and follows the user.

Persist hydration is async (AsyncStorage): `selectedTrailId` starts at its initial `null`
and rehydrates to the stored value after first render. `useSelectedTrail`'s effect keys on
`selectedTrailId`, so it naturally re-runs on hydration and loads the restored trail.

### 2. Split "trail is selected" from "fit the camera to it"

Today `selectTrail` conflates two concerns, and the fit is triggered by trail *identity*:

```ts
// mapStore.ts
selectTrail: (id) => set({ selectedTrailId: id, followMode: 'off' }),
```
```ts
// MapCanvas.tsx — fires whenever the loaded trail object changes
useEffect(() => { /* fitBounds(...) */ }, [trail])
```

On restore, `selectedTrailId` rehydrates → `useSelectedTrail` loads the trail → the
`[trail]` effect fires → the camera wrongly fits the trail. That contradicts the locked
decision.

Fix by separating the "fit" signal from the "selected" state, mirroring the existing
`northResetNonce` one-shot pattern already in this store:

- Add session-only state `trailFitNonce: number` (initial `0`, **not** in `partialize`).
- `selectTrail(id)` (only ever called by a user tap) sets the id, drops follow, **and**
  bumps the nonce:

  ```ts
  selectTrail: (id) =>
    set((s) => ({ selectedTrailId: id, followMode: 'off', trailFitNonce: s.trailFitNonce + 1 })),
  ```

- `MapCanvas`'s fit effect keys on `trailFitNonce` instead of `trail`, and guards on the
  nonce being > 0 (so it never fires on the initial mount), mirroring the `northResetNonce`
  effect directly above it:

  ```ts
  const trailFitNonce = useMapStore((s) => s.trailFitNonce)
  useEffect(() => {
    if (trailFitNonce === 0) return
    if (!hasTrail) return
    const bounds = boundsForPoints(points)
    if (!bounds) return
    const { top, sides, bottom } = MapTokens.cameraPadding
    cameraRef.current?.fitBounds(
      bounds.ne, bounds.sw, [top, sides, bottom, sides], MapTokens.trailFitDurationMs,
    )
  }, [trailFitNonce])
  ```

Result:
- **User tap** → `selectTrail` sets id + `followMode:'off'` + bumps nonce → overlay shows,
  camera fits (unchanged behavior).
- **Restore** → persist rehydrates `selectedTrailId` only; `followMode` stays default
  `'position'`; `trailFitNonce` stays `0` → overlay + card show, camera follows the user.
  Exactly the locked behavior.

This is a deliberate de-conflation of an existing single function (the kind AGENTS.md calls
for — change the pattern everywhere, don't fork it), not a workaround. It is also the seam
slice 2 reuses: a recording overlay must not fight the fit either.

> **Reviewer note / cross-task:** `points` and `hasTrail` are derived from `trail` but the
> effect deps list is `[trailFitNonce]` only. This is intentional and matches the
> `northResetNonce` effect: the nonce is bumped synchronously by the same user action that
> selects the trail, and by the time the nonce-driven effect needs geometry the trail has
> loaded. Do not add `trail`/`points` to the deps — that would reintroduce the
> identity-driven fit on restore. This mirrors the existing exhaustive-deps posture of the
> `northResetNonce` effect in the same file.

### 3. Self-heal a deleted trail on restore

If the persisted `selectedTrailId` points to a trail deleted in a previous session,
`trailsRepository.getTrail(id)` resolves `null` and `useSelectedTrail` already returns
`null` (no overlay, no card, no crash). Additionally clear the stale id so it does not
persist forward:

```ts
// useSelectedTrail.ts — inside the existing effect's .then, still under the `active` guard
trailsRepository.getTrail(selectedTrailId).then((loaded) => {
  if (!active) return
  if (loaded == null) clearSelectedTrail()
  setTrail(loaded)
})
```

`clearSelectedTrail` already exists and already nulls `selectedTrailId`; with
`selectedTrailId` now in `partialize`, that write also clears the persisted value on the
next persist flush. No new action needed.

## Data flow

```
app launch
  └─ mapStore persist hydrates: mapStyleId, selectedTrailId  (followMode = 'position' default)
        └─ useSelectedTrail effect [selectedTrailId] runs
              ├─ id == null            → trail = null → clean map
              ├─ getTrail(id) == null  → clearSelectedTrail() + trail = null → clean map (self-healed)
              └─ getTrail(id) == trail → trail set → overlay + info card render
                    └─ trailFitNonce == 0 → no fit → camera follows user (followMode 'position')

user taps a trail card
  └─ selectTrail(id): selectedTrailId=id, followMode='off', trailFitNonce++
        └─ MapCanvas fit effect [trailFitNonce] → fitBounds once
```

## Error handling

- **Deleted persisted trail:** handled by the self-heal above — no overlay, id cleared.
- **Corrupt/absent persisted value:** zustand persist falls back to the initial state
  (`selectedTrailId: null`) — clean map, no special handling needed.

## Testing

**Pure logic (Jest, TDD, in `src/store/__tests__/mapStore.test.ts`, mirroring existing
cases):**
- `selectTrail(id)` sets `selectedTrailId`, sets `followMode:'off'`, and increments
  `trailFitNonce`.
- `clearSelectedTrail()` sets `selectedTrailId` back to `null`.
- `partialize` includes both `mapStyleId` and `selectedTrailId` (and still excludes
  `followMode`, `trailFitNonce`, and the other session-only fields).

**Device-verified (native, not unit-tested):**
- Display a trail → kill the app → reopen → the trail's overlay + info card are restored
  and the camera is following the user's position (no fit animation to the trail).
- Tap a trail card (same session) → camera still fits the trail once (regression check).
- Close with no trail displayed → reopen → clean map, no overlay/card.
- Delete the displayed trail's row, then restart → clean map (self-heal), no crash.
