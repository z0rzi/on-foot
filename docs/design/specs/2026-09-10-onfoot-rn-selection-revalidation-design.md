# Selection Revalidation on a Mutation Version — Design

**Status:** Approved design
**Branch:** `refactor/selection-revalidation`
**Date:** 2026-09-10

## Goal

Resolve **PERF-1** and **DUP-8** from `docs/reviews/2026-09-10-full-review.md`: name a single
owner of "the selected entity may be stale", and stop paying for it on every tab switch.

`useSelectedEntity` re-runs its load whenever `revalidateOn` — the whole `trails` /
`activities` array — changes, and `loadTrails` always publishes a new array. That array is
reloaded on every focus of the Trails tab (`app/(tabs)/trails.tsx:25`) and of the Offline
maps screen (`src/map/offline/OfflineMapsList.tsx:24-28`). So merely visiting a list tab:

1. re-renders every consumer of `useSelectedTrail` (the hooks subscribe to the array), and
2. re-reads the selected trail's full geometry from SQLite (`JSON.parse` of the whole track),
   yielding a new `Trail` reference that invalidates every memo keyed on
   `trail.geometry.segments` — `MapScreen.activeProfile`, `useRouteColouring` (profile +
   banding + slope runs), the three `MapOverlays` memos — and hands Mapbox new `ShapeSource`
   shapes to re-upload natively.

Nothing about the selected trail changed. The list reference is simply the wrong signal.

## Existing shape

The closest existing feature of the same shape is **`useSelectedEntity` itself** — this is a
correction to it, not a second instance. It already generalises both selection hooks
(`useSelectedTrail`, `useSelectedActivity`), and both keep delegating to it unchanged; only
the argument it revalidates on changes. Nothing new is extracted, because the shared unit
already exists and is the thing being fixed.

The second shape involved is the **`trailsStore` / `activitiesStore` renamed-copy pair**
(DUP-6 in the review, accepted "until a third entity store appears"). The version counter is
added to both in the *identical* shape so the pair does not fork; when a third entity store
appears, that pair — counter included — is what gets extracted.

## Scope

- `src/store/trailsStore.ts`, `src/store/activitiesStore.ts` — add the version.
- `src/map/useSelectedEntity.ts` — the revalidation key becomes that version.
- `src/map/useSelectedTrail.ts`, `src/map/useSelectedActivity.ts` — subscribe to the version.
- `app/(tabs)/activities.tsx` — drop the hand-written pre-delete `clearSelection` (DUP-8).

**Out of scope:** PERF-2 / DUP-2 (the triple profile+banding derivation), the `useLoadedEntity`
extraction (DUP-3/DUP-4), and making the *list* itself identity-stable across focus reloads.
The last is a separate, larger question — see "Rejected" below.

## The change

### One owner: the store's mutation version

Both stores gain `version: number`, starting at `0`. It counts **mutations**, not loads.

Inside `create`, a local `commit()` closure is the only thing that bumps it:

```ts
const commit = async () => {
  await get().loadTrails()
  set((s) => ({ version: s.version + 1 }))
}
```

Every mutation (`addTrail`, `updateTrail`, `removeTrail`; `saveActivity`, `removeActivity`)
ends with `await commit()` in place of `await get().loadTrails()`. `loadTrails` stays public
and version-neutral, because that is exactly the focus-refresh path that must *not* invalidate
the selection.

The point of the closure is that the bump cannot be forgotten: reloading-after-a-mutation and
bumping the version are one operation with one name, not a convention each mutation has to
remember. That is what `POST-WORK.md` means by a guarantee named in one place, and it is
precisely what DUP-8 flags as missing today.

`commit` is not on the `TrailsStore` interface — it is store-internal, not app API.

### The hook states its contract

`useSelectedEntity`'s third parameter goes from `revalidateOn: unknown` to
`mutationVersion: number`, and the comment stops apologising for an argument that is never
read: it now says what the number is. The body, the id-keyed `loaded` state, and the
clear-on-missing behaviour are untouched.

`useSelectedTrail` / `useSelectedActivity` select `s.version` instead of `s.trails`, which also
removes the re-render that fired before the effect even ran.

### DUP-8: one deletion path

`app/(tabs)/activities.tsx` currently clears the selection by hand before deleting, while
`app/(tabs)/trails.tsx` relies on the hook (a load returning `null` clears). The manual clear
goes: `removeActivity` bumps the version, the reload returns `null`, the hook clears. One
mechanism, the one the trails tab already uses.

## Rejected alternatives

**Keep the previous array when the summaries are unchanged.** Tempting — it would fix the list
re-render too, and needs no new concept — but it is **unsound here**: `TrailUpdate` writes
`description`, which is not a field of `TrailSummary`. A description-only edit leaves every
summary equal, so the array would be kept, the selection never revalidated, and the trail info
sheet would show a stale description. It would need an `updatedAt` on the summary to be
correct. Identity-stable lists remain a reasonable *separate* change for list re-renders; they
are not a substitute for a mutation signal.

**Move selection ownership into `mapStore`** (the store holds the loaded entity and mutations
push into it). Genuinely one owner, but it drags database reads into the store layer and is an
M–L restructuring for an S-sized problem.

## Consequences accepted

- **Deleting the selected activity clears one async tick later** than today: the map holds the
  deleted track until the reload returns `null`. The trails tab already behaves this way; the
  cost of the alternative is the drifting per-call-site convention DUP-8 names.
- **The version is monotonic and unbounded.** A `number` counting user-initiated mutations will
  not approach `Number.MAX_SAFE_INTEGER` in any real session.
- **A mutation still costs a full reload of the selected entity.** That is correct — it is the
  case where the entity may genuinely have changed. Only the focus path gets cheaper.

## Test plan (Jest, written first)

`useSelectedEntity` has **no** test and gains none: the React Native testing library was removed
in `a8e4793`, and this repo's rule is that pure logic is TDD'd while rendering is
device-verified. The behaviour being changed is store behaviour, and that is where it is pinned.

`src/store/__tests__/trailsStore.test.ts` (its repo mock needs `updateTrail: jest.fn()`, absent
today):
- `loadTrails` leaves `version` unchanged across repeated calls
- `addTrail` increments `version`
- `updateTrail` increments `version`
- `removeTrail` increments `version`

`src/store/__tests__/activitiesStore.test.ts`:
- `loadActivities` leaves `version` unchanged across repeated calls
- `saveActivity` increments `version`
- `removeActivity` increments `version`

## Device verification

- Select a trail on the map, switch to the Trails tab and back: the route, the slope colouring
  and the elevation graph must not flicker or rebuild.
- Edit the selected trail's name and description: both update on the map sheet.
- Delete the selected trail, and separately the selected activity: the map clears in both cases.
