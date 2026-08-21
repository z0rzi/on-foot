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

Fix by modelling the fit *intent* as its own session-only state that names the trail to be
framed — distinct from `selectedTrailId`, which describes only *what is shown* and is now
also set by restore:

- Add session-only state `pendingFitTrailId: number | null` (initial `null`, **not** in
  `partialize`), plus a `clearPendingFit()` action.
- `selectTrail(id)` (only ever called by a user tap) sets the id, drops follow, **and** marks
  the pending fit; `clearSelectedTrail` also cancels any pending fit:

  ```ts
  selectTrail: (id) => set({ selectedTrailId: id, followMode: 'off', pendingFitTrailId: id }),
  clearSelectedTrail: () => set({ selectedTrailId: null, pendingFitTrailId: null }),
  clearPendingFit: () => set({ pendingFitTrailId: null }),
  ```

- `MapCanvas`'s fit effect fires once per user-requested selection **after that trail's own
  geometry has loaded**, and never on restore. The geometry loads asynchronously
  (`useSelectedTrail` → `getTrail`) and `TrailSummary` carries no geometry, so the loaded
  `trail` prop lags the synchronous `selectTrail`. The pending-fit field carries exactly the
  information needed to bridge that gap — *which* trail to fit — so the effect simply waits
  until the loaded geometry belongs to it, then consumes the request by clearing it:

  ```ts
  const pendingFitTrailId = useMapStore((s) => s.pendingFitTrailId)
  const clearPendingFit = useMapStore((s) => s.clearPendingFit)
  useEffect(() => {
    if (trail == null || trail.id !== pendingFitTrailId) return  // no pending fit (incl. restore) / geometry not for this trail yet
    if (trail.geometry.points.length < 2) return
    const bounds = boundsForPoints(trail.geometry.points)
    if (!bounds) return
    clearPendingFit()
    const { top, sides, bottom } = MapTokens.cameraPadding
    cameraRef.current?.fitBounds(
      bounds.ne, bounds.sw, [top, sides, bottom, sides], MapTokens.trailFitDurationMs,
    )
  }, [trail, pendingFitTrailId, clearPendingFit])
  ```

Result:
- **User tap (clean → A)** → `selectTrail` sets id + `followMode:'off'` + `pendingFitTrailId=A`;
  the effect waits until A's geometry loads (`trail.id === pendingFitTrailId`), then fits once
  and clears the pending fit.
- **Switch A → B** → the intermediate render (`pendingFitTrailId=B`, `trail` still A) fails
  `trail.id === pendingFitTrailId` and is skipped without consuming the request; when B loads,
  it fits B.
- **Restore** → persist rehydrates `selectedTrailId` only; `followMode` stays default
  `'position'`; `pendingFitTrailId` stays `null` → overlay + card show, camera follows the
  user. Exactly the locked behavior.

Modelling intent directly (rather than a fire-and-forget nonce) keeps the effect's dependency
array honest — it depends on exactly the state it reads — and makes "restore doesn't fit" fall
out for free (there is simply no pending fit). It is also the seam slice 2 reuses: a recording
overlay must not fight the fit either.

> **Cross-task note:** `pendingFitTrailId` is intent (a user tap asked to frame this trail),
> deliberately separate from `selectedTrailId` (what is shown, which restore also sets). The
> `northResetNonce` nonce pattern was **not** a fit for this: `resetNorth()` needs no data and
> can fire the instant its nonce bumps, whereas `fitBounds()` needs geometry that arrives
> asynchronously *after* the tap — so the fit signal must name *which* trail, not just *when*.
> Consuming the request via `clearPendingFit()` is what makes it one-shot; the effect never
> re-fires because the field is null afterwards.

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
                    └─ pendingFitTrailId == null → no fit → camera follows user (followMode 'position')

user taps a trail card
  └─ selectTrail(id): selectedTrailId=id, followMode='off', pendingFitTrailId=id   (synchronous)
        └─ getTrail(id) resolves async → trail set (trail.id == id)
              └─ MapCanvas fit effect [trail, pendingFitTrailId, clearPendingFit]:
                    trail.id == pendingFitTrailId → clearPendingFit() + fitBounds once
```

## Error handling

- **Deleted persisted trail:** handled by the self-heal above — no overlay, id cleared.
- **Corrupt/absent persisted value:** zustand persist falls back to the initial state
  (`selectedTrailId: null`) — clean map, no special handling needed.

## Testing

**Pure logic (Jest, TDD, in `src/store/__tests__/mapStore.test.ts`, mirroring existing
cases):**
- `selectTrail(id)` sets `selectedTrailId`, sets `followMode:'off'`, and sets
  `pendingFitTrailId` to the id.
- `clearSelectedTrail()` sets `selectedTrailId` and `pendingFitTrailId` back to `null`.
- `clearPendingFit()` nulls `pendingFitTrailId` without touching `selectedTrailId`.
- `partialize` includes both `mapStyleId` and `selectedTrailId` (and still excludes
  `followMode`, `pendingFitTrailId`, and the other session-only fields).

**Device-verified (native, not unit-tested):**
- Display a trail → kill the app → reopen → the trail's overlay + info card are restored
  and the camera is following the user's position (no fit animation to the trail).
- Tap a trail card (same session) → camera still fits the trail once (regression check).
- Close with no trail displayed → reopen → clean map, no overlay/card.
- Delete the displayed trail's row, then restart → clean map (self-heal), no crash.
