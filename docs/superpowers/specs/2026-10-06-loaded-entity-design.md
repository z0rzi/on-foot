# Loaded-entity extraction (review backlog item 6)

Closes `DUP-3`, `DUP-4` and `ERR-3` from `docs/reviews/2026-09-10-full-review.md`.

## Problem

Three places load an entity by id, key the result to that id, and derive it during render. None of
them has a failure outcome: a rejected repository call becomes an unhandled rejection, and on the two
route screens the spinner never exits — no retry, no back, a stuck screen. Three more places repeat a
byte-identical centred spinner, and the `/trail/new?uri=` href is assembled by hand in four.

Two of the review's claims did not survive contact with the code, and this spec corrects them:

- **`BackButton` is already extracted.** `src/components/ScreenHeader.tsx:16-18` holds the back
  `Pressable` and its `accessibilityLabel`, and both sites `DUP-4` named now route through it.
- **`DUP-3`'s "five copies" are three copies and two different shapes.** `app/activity/save.tsx`
  loads a *singleton* (`getActiveSession()`) plus a dependent read, so it has no id to key to;
  `app/trail/new.tsx` reads a file off a `uri` and parses GPX, with two domain-specific failures it
  already handles correctly. What those two share with the third screen is the spinner and the
  leave-on-failure skeleton — `LoadingScreen`, not the hook. Forcing them through
  `useLoadedEntity(id, load)` would mean inventing a key, which is reshaping correct code to fit a
  helper.

## Existing shape

The closest existing feature of the same shape is **`src/map/useSelectedEntity.ts`**, which the
earlier health check already extracted from two copies of the map's trail/activity load. It is the
first instance of exactly this pattern: an id-keyed `useState`, a cancel flag, and a render-time
derivation that discards a stale result rather than clearing it with a setState-in-effect.

This spec generalises that proven core into `useLoadedEntity` and leaves `useSelectedEntity` as the
map-specific adapter above it (selection kind to id, `clearSelection` on failure). Its two mechanisms
are reused verbatim in spirit: keying the stored result to the id it was loaded for, and deriving the
answer during render.

Also reused: `src/components/ScreenHeader.tsx` (so no back button is extracted),
`src/components/useGoBackOrHome.ts` (the leave behaviour on all three screens), the app's single
error-surfacing idiom `Alert.alert('Could not …', 'Something went wrong. Please try again.')` —
23 existing call sites — and `logEvent` from `src/log`.

Extracted to be shared: `resolveLoad` + `useLoadedEntity`, `LoadingScreen`, `newTrailHref`, and
`loadTrail`, which is about to have three callers.

## Design

### `src/components/loadedEntity.ts` — the pure core

```ts
export type LoadOutcome<T> =
  | { status: 'idle' | 'loading' | 'missing' | 'error'; entity: null }
  | { status: 'ready'; entity: T }

export type LoadedState<T> = { id: number; result: { ok: true; entity: T | null } | { ok: false } }

export function resolveLoad<T>(id: number | null, loaded: LoadedState<T> | null): LoadOutcome<T>
```

Every decision lives here, with no React involved:

| condition | outcome |
| --- | --- |
| `id == null` | `idle` |
| `loaded == null`, or `loaded.id !== id` | `loading` — this is the stale-result discard |
| `loaded.result.ok === false` | `error` |
| `loaded.result.entity == null` | `missing` |
| otherwise | `ready`, carrying the entity |

### `src/components/useLoadedEntity.ts` — the wiring only

```ts
useLoadedEntity<T>(
  id: number | null,
  load: (id: number) => Promise<T | null>,
  options: { label: string; version?: number; onUnavailable?: (reason: 'missing' | 'error') => void },
): LoadOutcome<T>
```

- `load` must be module-level: it sits in the effect's dep array, so an inline arrow would reload on
  every render. This constraint and its reason carry over from `useSelectedEntity`.
- `onUnavailable` is held in a ref and kept **out** of the effect deps, so a call site can pass an
  inline arrow without re-triggering the load. Two of the three call sites want a closure, so without
  this the helper would ship with a live footgun.
- `version` is the owning store's mutation count, unchanged in meaning: it changes exactly when the
  entity may have changed, so a focus refresh of a list does not re-read the entity. Defaults to `0`.
- `label` is required. A log line that does not say what failed to load is useless.
- The effect keeps the existing cancel flag, so a result arriving after unmount or after an id change
  is dropped without a setState.

### `src/components/LoadingScreen.tsx`

The centred `ActivityIndicator` (`size="large"`, `color={c.controlAccent}`) on `c.background`, taken
verbatim from the three copies, including the `styles.center` the three share.

### `src/trails/newTrailHref.ts`

```ts
export function newTrailHref(uri: string, name?: string | null): string
```

Returns `/trail/new?uri=…` with `&name=…` appended only when `name` is non-empty. Built with
`encodeURIComponent`, not `URLSearchParams`, which form-encodes a space as `+`. The return type is a
plain `string` because `app/+native-intent.ts` is contractually a `string`-returning function.

## Site-by-site changes

| site | change |
| --- | --- |
| `src/map/useSelectedEntity.ts` | keeps its map-specific job — selection kind to id, `clearSelection` — and delegates the load. `onUnavailable: clearSelection` covers missing and error alike; it still returns `T \| null`, so `MapScreen` is untouched |
| `src/map/ActivityInfoSheet.tsx:30-42` | 13 lines become one `useLoadedEntity(activity.linkedTrailId, loadTrail, { label: 'linked trail' })`. No `onUnavailable`: a missing link is simply no link rendered |
| `app/trail/[id]/edit.tsx` | hook plus `LoadingScreen`. `onUnavailable` alerts when the reason is `error` and leaves in both cases, which preserves today's silent leave on a deleted trail |
| `app/activity/save.tsx` | keeps its two-stage singleton load, adopts `LoadingScreen`, and gains a `.catch` to alert and `goToMap()`. The existing silent `goToMap()` when there is no active session stays: that is the normal path after a save or discard elsewhere, not a failure |
| `app/trail/new.tsx` | `LoadingScreen` only. Its `GpxError` handling is already correct and domain-specific and is not touched |
| `src/trails/useIncomingShare.ts:12,21`, `app/+native-intent.ts:3`, `app/(tabs)/trails.tsx:73` | call `newTrailHref`; `trails.tsx` moves from the object form to the string form, which is equivalent (an omitted empty name still lands as `''` via `new.tsx`'s own `?? ''`) |

`loadTrail` is exported from `src/data/trails/index.ts`, which gives it one owner for its three
callers. `loadActivity` stays in `src/map/useSelectedActivity.ts`, still its only caller — extracting
it too would be symmetry for its own sake.

## Failure handling

`ERR-3`'s four sites all end up covered: `useSelectedEntity`, `ActivityInfoSheet` and `edit.tsx`
through the hook's rejection branch, `save.tsx` through its own catch.

The user-visible behaviour, matching the app's existing division between blocking and non-blocking
surfaces:

- **Route screens** show `Alert.alert('Could not open this trail', 'Something went wrong. Please try
  again.')` — wording per screen — and then leave.
- **A failed map selection** clears the selection with no dialog. Nothing had opened yet, the map
  stays usable, and the detail is in the debug log.
- **A failed linked-trail load** renders no link.

The hook logs every outcome the caller cannot see: a rejection at `error`/`error`, a `missing` at
`warn`/`error`, both carrying the label. An entity vanishing mid-navigation is exactly the kind of
field mystery the debug log exists for, and both are rare events rather than a hot path.

## Testing

TDD'd, per `AGENTS.md`:

- `resolveLoad` — all five branches, plus the stale-id case (a result keyed to the previous id while a
  new id is in flight) and the version-change case.
- `newTrailHref` — a uri with spaces, `#` and `&`; name present, empty and null.

Device-verified, as all React and native behaviour in this project is: the hook's effect wiring and
`LoadingScreen`.

## Device checklist

1. Open a trail from the list and edit it — spinner, then the form; save changes.
2. Stop a recording: the save screen shows the spinner then the form. Both save and discard.
3. Import a GPX by share *and* by document picker, plus one malformed file (the two alerts).
4. Select a trail and an activity on the map — each sheet appears.
5. Follow an activity's linked-trail link.
6. Delete a trail while it is the map's selection: the `missing` path clears the selection.

## Out of scope

No `BackButton` (`ScreenHeader` is already it; the backlog row is corrected as part of this work). No
reshaping of `save.tsx`'s or `new.tsx`'s load bodies to fit a hook they do not fit. No new test
dependency: hook-level testing would need `@testing-library/react-native`, which is a deliberate,
separately-scoped decision about all of this project's untested hooks, not something to smuggle in
here.
