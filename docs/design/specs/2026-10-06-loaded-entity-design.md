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
5 existing call sites — and `logEvent` from `src/log`.

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
- `onUnavailable` is read through a ref kept **out** of the effect deps, so a call site can pass an
  inline arrow without re-triggering the load. Two of the three call sites want a closure, so without
  this the helper would ship with a live footgun. The ref is seeded by `useRef` and updated in its
  own effect, never during render: `react-hooks/refs` is an `error` in `eslint.config.js:50`, the
  repo's two existing disables of it are both justified as writes that happen *never during render*,
  and a render React discards would still mutate a render-phase write, leaving the ref holding a
  closure from a tree that was never committed. `.current` is only ever read from an async promise
  callback, so it is always read post-commit.
- `version` is the owning store's mutation count, unchanged in meaning: it changes exactly when the
  entity may have changed, so a focus refresh of a list does not re-read the entity. Defaults to `0`.
- `label` is required. A log line that does not say what failed to load is useless.
- The effect keeps the existing cancel flag, so a result arriving after unmount or after an id change
  is dropped without a setState.

### `src/components/LoadingScreen.tsx`

The centred `ActivityIndicator` (`size="large"`, `color={c.controlAccent}`) on `c.background`, taken
verbatim from the copies, including the `styles.center` they share.

There are **four** copies, not the three the review names: `src/log/LogList.tsx:63-68` is the same
block without a `backgroundColor`, because it renders inside a screen that already paints one. It is
absorbed too rather than left behind as an unnamed fourth instance — `app/settings/log.tsx:11` wraps
it in a `View` with `backgroundColor: c.background`, so painting the same colour again is visually
identical and the component needs no prop to cover the case.

### `src/trails/newTrailHref.ts`

```ts
export function newTrailHref(uri: string, name?: string | null): `/trail/new?${string}`
```

Returns `/trail/new?uri=…` with `&name=…` appended only when `name` is non-empty. Built with
`encodeURIComponent`, not `URLSearchParams`, which form-encodes a space as `+`.

The return type is the template-literal type, **not** `string`. `app.config.ts:81` enables
`experiments.typedRoutes`, so `router.push` accepts only the generated `Href` union, and today's call
sites compile solely because a template-literal *expression* is checked structurally against that
pattern. A `string`-returning helper breaks three of the four sites — verified against this
toolchain: `error TS2345: Argument of type 'string' is not assignable to parameter of type
'"/trail/new" | ``/trail/new?${string}`` | …'`. A template-literal type is itself a `string` subtype,
so `app/+native-intent.ts`'s declared `: string` return still accepts it.

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
field mystery the debug log exists for, and a rejection is a rare event. A `missing` from the
linked-trail path is not: nothing clears `linkedTrailId` when the trail it points to is deleted, so
that id is a permanent dangling reference and the `warn` repeats on every open of the activity's
sheet. That is a pre-existing data defect this hook surfaced rather than caused — recorded as ERR-7
in `docs/reviews/2026-09-10-full-review.md`.

## Testing

TDD'd, per `AGENTS.md`:

- `resolveLoad` — all five branches, plus the stale-id case (a result keyed to the previous id while
  a new id is in flight), a stale *failure* not being reported for a new id, and the refresh case,
  which at this level is "the same id stays `ready` while a reload is in flight, so no spinner
  flicker". `version` is not an input to `resolveLoad`; it only re-runs the hook's effect.
  A non-numeric route param reaches `Number(params.id)` as `NaN`, which `!==` itself, so the guard
  treats a non-finite id as `idle` rather than letting it read as loading forever.
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

No helper for the cancel-flag / log / alert / leave skeleton either, even though the Problem section
above names it as shared with `save.tsx` and `new.tsx`. After this work that skeleton exists in three
spellings — `useLoadedEntity.ts`, `save.tsx`, `new.tsx` — and only the spinner inside it
(`LoadingScreen`) was actually extracted. A helper spanning a singleton two-stage read and a GPX
parse with three domain-specific outcomes would have to parameterise over all three, which makes it
the premature abstraction `AGENTS.md` warns against as much as it warns against the duplication that
motivated this spec. Left as three spellings; revisit only if a fourth screen needs the same shape.

Two unhandled-rejection paths in files this work edits are **not** `ERR-3` sites and are not fixed
here, because both need a decision this spec has not made: `app/(tabs)/trails.tsx:26`'s
`void loadTrails()` (that is `ERR-5`, its own backlog row), and `app/trail/new.tsx:51`, where
`metricsForSegments` sits outside the surrounding `try` — a throw there is an unhandled rejection
behind a spinner that never exits. Folding it into the existing `try` would label it with that
block's "Not a GPX file" alert, which would be a lie about what failed. It is recorded as a new
finding instead.
