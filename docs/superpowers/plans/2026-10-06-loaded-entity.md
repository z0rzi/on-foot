# Loaded-Entity Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace three hand-rolled "load an entity by id" copies with one tested hook that has a
failure outcome, collapse three identical spinners into `LoadingScreen`, and give the
`/trail/new?uri=` href one owner.

**Architecture:** All load decisions move into a pure `resolveLoad` function that is TDD'd with no
React involved; `useLoadedEntity` is only effect wiring above it. The map keeps its own adapter
(`useSelectedEntity`) for selection-to-id and `clearSelection`. The two screens whose loads are *not*
id-keyed (`save.tsx`, a singleton; `new.tsx`, a file parse) keep their own load bodies and take only
the spinner, because forcing them through the hook would mean inventing a key.

**Tech Stack:** TypeScript 6, React 19 / React Native 0.86, Expo SDK 57, expo-router, zustand,
Jest 29 via jest-expo.

**Spec:** `docs/superpowers/specs/2026-10-06-loaded-entity-design.md`
**Backlog:** item 6 of `docs/reviews/2026-09-10-full-review.md` (`DUP-3`, `DUP-4`, `ERR-3`)

## Global Constraints

- `npm run verify` (`tsc --noEmit && jest && expo lint`) must be green before any task is done.
- No JSDoc. Comments explain *why*, never what changed, and only where the code is not
  self-documenting (`AGENTS.md`).
- Commit subjects: lowercase conventional-commit, one sentence, no body.
- Pure logic is TDD'd (`src/**/__tests__/*.test.ts`); React and native behaviour is device-verified.
- No new dependency. In particular, do **not** add `@testing-library/react-native`.
- The debug log never records coordinates. Ids, counts and error strings are fine.
- `logEvent(level, area, message, detail?)` from `src/log`; `LogLevel` is `'info' | 'warn' | 'error'`
  and `LogArea` is `'recording' | 'capture' | 'launch' | 'map' | 'error'`. No other values exist.
- A `load` function passed to `useLoadedEntity` must be module-level: it sits in the effect's dep
  array, so an inline arrow would reload on every render.
- Tests use `describe` / `test` (not `it`), matching `src/map/__tests__/geo.test.ts`.

---

### Task 1: `resolveLoad`, the pure core

**Files:**
- Create: `src/components/loadedEntity.ts`
- Test: `src/components/__tests__/loadedEntity.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `LoadOutcome<T>`, `LoadResult<T>`, `LoadedState<T>`, and
  `resolveLoad<T>(id: number | null, loaded: LoadedState<T> | null): LoadOutcome<T>`. Task 2 wires
  this into a hook; Tasks 3–5 consume the hook, not this function.

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/loadedEntity.test.ts`:

```ts
import { LoadedState, resolveLoad } from '../loadedEntity'

type Trail = { id: number; name: string }

const resolved = (id: number, name = 'Ridge'): LoadedState<Trail> => ({
  id,
  result: { ok: true, entity: { id, name } },
})
const absent = (id: number): LoadedState<Trail> => ({ id, result: { ok: true, entity: null } })
const failed = (id: number): LoadedState<Trail> => ({ id, result: { ok: false } })

describe('resolveLoad', () => {
  test('no id -> idle', () => {
    expect(resolveLoad(null, null)).toEqual({ status: 'idle', entity: null })
  })

  test('no id discards a result from when there was one', () => {
    expect(resolveLoad(null, resolved(1))).toEqual({ status: 'idle', entity: null })
  })

  test('nothing loaded yet -> loading', () => {
    expect(resolveLoad(1, null)).toEqual({ status: 'loading', entity: null })
  })

  test('a result keyed to the previous id -> loading, never the stale entity', () => {
    expect(resolveLoad(2, resolved(1))).toEqual({ status: 'loading', entity: null })
  })

  test('a failure keyed to the previous id is not reported for the new id', () => {
    expect(resolveLoad(2, failed(1))).toEqual({ status: 'loading', entity: null })
  })

  test('a rejected load -> error', () => {
    expect(resolveLoad(1, failed(1))).toEqual({ status: 'error', entity: null })
  })

  test('a load that resolved null -> missing', () => {
    expect(resolveLoad(1, absent(1))).toEqual({ status: 'missing', entity: null })
  })

  test('a load that resolved an entity -> ready, carrying it', () => {
    expect(resolveLoad(1, resolved(1, 'Col du Palet'))).toEqual({
      status: 'ready',
      entity: { id: 1, name: 'Col du Palet' },
    })
  })

  test('the same id stays ready while a refresh is in flight, so no spinner flicker', () => {
    const outcome = resolveLoad(1, resolved(1))
    expect(outcome.status).toBe('ready')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/components/__tests__/loadedEntity.test.ts`
Expected: FAIL — `Cannot find module '../loadedEntity'`.

- [ ] **Step 3: Write the implementation**

Create `src/components/loadedEntity.ts`:

```ts
export type LoadOutcome<T> =
  | { status: 'idle' | 'loading' | 'missing' | 'error'; entity: null }
  | { status: 'ready'; entity: T }

export type LoadResult<T> = { ok: true; entity: T | null } | { ok: false }

export type LoadedState<T> = { id: number; result: LoadResult<T> }

// A result is stored under the id it was loaded for, so one keyed to a different id is a stale
// answer to a question nobody is asking any more: it reads as still loading rather than being
// cleared with a setState-in-effect.
export function resolveLoad<T>(id: number | null, loaded: LoadedState<T> | null): LoadOutcome<T> {
  if (id == null) return { status: 'idle', entity: null }
  if (loaded == null || loaded.id !== id) return { status: 'loading', entity: null }
  if (!loaded.result.ok) return { status: 'error', entity: null }
  if (loaded.result.entity == null) return { status: 'missing', entity: null }
  return { status: 'ready', entity: loaded.result.entity }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/components/__tests__/loadedEntity.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/loadedEntity.ts src/components/__tests__/loadedEntity.test.ts
git commit -m "feat(components): resolve a keyed load into one outcome, so a stale result cannot be read"
```

---

### Task 2: `useLoadedEntity`, and the map's adapter on top of it

**Files:**
- Create: `src/components/useLoadedEntity.ts`
- Modify: `src/map/useSelectedEntity.ts` (whole file, currently 34 lines)

**Interfaces:**
- Consumes: `resolveLoad`, `LoadOutcome`, `LoadedState` from Task 1.
- Produces:
  ```ts
  useLoadedEntity<T>(
    id: number | null,
    load: (id: number) => Promise<T | null>,
    options: { label: string; version?: number; onUnavailable?: (reason: 'missing' | 'error') => void },
  ): LoadOutcome<T>
  ```
  Tasks 3 and 4 call this. `useSelectedEntity`'s own signature is unchanged, so
  `useSelectedTrail`, `useSelectedActivity` and `MapScreen` keep compiling untouched.

**Why `onUnavailable` lives in a ref:** two of the three call sites pass a closure over their own
navigation. If the callback were in the effect's dep array, an inline arrow would re-run the load on
every render. Holding it in a ref and reading `.current` inside the promise callback keeps the deps
honest and lets call sites pass an arrow safely.

- [ ] **Step 1: Write the hook**

Create `src/components/useLoadedEntity.ts`:

```ts
import { useEffect, useRef, useState } from 'react'
import { logEvent } from '../log'
import { LoadOutcome, LoadedState, resolveLoad } from './loadedEntity'

export function useLoadedEntity<T>(
  id: number | null,
  load: (id: number) => Promise<T | null>,
  options: { label: string; version?: number; onUnavailable?: (reason: 'missing' | 'error') => void },
): LoadOutcome<T> {
  const { label, version = 0, onUnavailable } = options
  const [loaded, setLoaded] = useState<LoadedState<T> | null>(null)
  // Read through a ref so the callback can be an inline arrow at the call site: in the effect's
  // dep array it would re-run the load on every render.
  const unavailable = useRef(onUnavailable)
  unavailable.current = onUnavailable

  useEffect(() => {
    if (id == null) return
    let active = true
    void load(id).then(
      (entity) => {
        if (!active) return
        setLoaded({ id, result: { ok: true, entity } })
        if (entity == null) {
          logEvent('warn', 'error', `${label} not found`, { id })
          unavailable.current?.('missing')
        }
      },
      (err: unknown) => {
        if (!active) return
        setLoaded({ id, result: { ok: false } })
        logEvent('error', 'error', `${label} load failed`, { id, error: String(err) })
        unavailable.current?.('error')
      },
    )
    // A result that arrives after an id change or after unmount is dropped rather than stored.
    return () => {
      active = false
    }
  }, [id, version, label, load])

  return resolveLoad(id, loaded)
}
```

- [ ] **Step 2: Rewrite the map adapter on top of it**

Replace the whole contents of `src/map/useSelectedEntity.ts`:

```ts
import { useMapStore } from '../store/mapStore'
import { useLoadedEntity } from '../components/useLoadedEntity'

// `load` sits in the hook's effect dep array, so callers pass a module-level function — an inline
// arrow would reload on every render. `mutationVersion` is the store's count of mutations to the
// collection: it changes exactly when the entity may have changed, so a focus refresh of the list
// does not re-read the entity.
export function useSelectedEntity<T extends { id: number }>(
  kind: 'trail' | 'activity',
  load: (id: number) => Promise<T | null>,
  mutationVersion: number,
): T | null {
  const selection = useMapStore((s) => s.selection)
  const clearSelection = useMapStore((s) => s.clearSelection)
  const entityId = selection?.kind === kind ? selection.id : null
  // An entity that is gone or unreadable leaves the map holding a selection that can never resolve,
  // so drop it. Nothing had opened yet, so there is no dialog: the hook logs the detail.
  return useLoadedEntity(entityId, load, {
    label: kind,
    version: mutationVersion,
    onUnavailable: clearSelection,
  }).entity
}
```

- [ ] **Step 3: Verify the whole gate**

Run: `npm run verify`
Expected: PASS — types, 535 tests (526 + Task 1's 9), lint clean. The type-checker is what proves
`useSelectedTrail`, `useSelectedActivity` and `MapScreen` still line up with the unchanged signature.

- [ ] **Step 4: Commit**

```bash
git add src/components/useLoadedEntity.ts src/map/useSelectedEntity.ts
git commit -m "feat(components): load a keyed entity through one hook that reports missing and failed loads"
```

---

### Task 3: one owner for `loadTrail`, and the linked-trail load

**Files:**
- Modify: `src/data/trails/index.ts` (append one export)
- Modify: `src/map/useSelectedTrail.ts` (drop its local loader)
- Modify: `src/map/ActivityInfoSheet.tsx:1` and `:25-42`

**Interfaces:**
- Consumes: `useLoadedEntity` from Task 2.
- Produces: `loadTrail: (id: number) => Promise<Trail | null>`, exported from `src/data/trails`.
  Task 4 imports it.

- [ ] **Step 1: Give `loadTrail` one owner**

Append to `src/data/trails/index.ts`:

```ts
// Module-level so it is a stable dependency for useLoadedEntity's effect.
export const loadTrail = (id: number) => trailsRepository.getTrail(id)
```

- [ ] **Step 2: Point `useSelectedTrail` at it**

In `src/map/useSelectedTrail.ts`, delete the local `const loadTrail = (id: number) =>
trailsRepository.getTrail(id)` line and change the import so the file reads:

```ts
import { Trail, loadTrail } from '../data/trails'
import { useTrailsStore } from '../store/trailsStore'
import { useSelectedEntity } from './useSelectedEntity'

export function useSelectedTrail(): Trail | null {
  const version = useTrailsStore((s) => s.version)
  return useSelectedEntity('trail', loadTrail, version)
}
```

- [ ] **Step 3: Replace the sheet's hand-rolled load**

In `src/map/ActivityInfoSheet.tsx`, delete line 1 entirely (`import { useEffect, useState } from
'react'` — neither is used afterwards), change the trails import to pull `loadTrail`, add the hook
import, and replace lines 25-42 (the `loaded` state, the `linkedTrailId` const, the `useEffect`, and
the `linkedTrail` derivation) with one call.

The import block becomes:

```ts
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Activity } from '../data/activities/types'
import { loadTrail } from '../data/trails'
import { useTheme } from '../theme/useTheme'
import { useLoadedEntity } from '../components/useLoadedEntity'
```

(keep every other existing import in the file untouched), and the body's first lines become:

```ts
  const c = useTheme()
  // A link that is gone is simply not rendered; the hook logs it.
  const { entity: linkedTrail } = useLoadedEntity(activity.linkedTrailId, loadTrail, {
    label: 'linked trail',
  })
```

Note the `Trail` type import is no longer needed in this file — `linkedTrail` is inferred. Leave the
rest of the component, its `styles`, and the `{linkedTrail && …}` block exactly as they are.

- [ ] **Step 4: Verify**

Run: `npm run verify`
Expected: PASS. If `Trail` or `trailsRepository` is reported as an unused import in either modified
file, remove it — that is the signal that the hand-rolled load is fully gone.

- [ ] **Step 5: Commit**

```bash
git add src/data/trails/index.ts src/map/useSelectedTrail.ts src/map/ActivityInfoSheet.tsx
git commit -m "refactor(map): load the linked trail through the shared hook, and give loadTrail one owner"
```

---

### Task 4: `LoadingScreen`, and the edit screen's failure path

**Files:**
- Create: `src/components/LoadingScreen.tsx`
- Modify: `app/trail/[id]/edit.tsx` (whole file, currently 63 lines)

**Interfaces:**
- Consumes: `useLoadedEntity` (Task 2), `loadTrail` (Task 3).
- Produces: `LoadingScreen` (no props). Task 5 uses it twice more.

**A TypeScript detail that decides the shape of the screen code:** destructuring
`const { status, entity } = useLoadedEntity(...)` breaks the discriminated union — `entity` stays
`T | null` no matter what you then check `status` against. Keep the object and narrow through it
(`loaded.status !== 'ready'`) wherever you need the entity to be non-null. Destructure only where
`T | null` is exactly what you want, as Task 3 does.

- [ ] **Step 1: Write `LoadingScreen`**

Create `src/components/LoadingScreen.tsx`:

```tsx
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { useTheme } from '../theme/useTheme'

export function LoadingScreen() {
  const c = useTheme()
  return (
    <View style={[styles.center, { backgroundColor: c.background }]}>
      <ActivityIndicator size="large" color={c.controlAccent} />
    </View>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})
```

- [ ] **Step 2: Rewrite the edit screen**

Replace the whole contents of `app/trail/[id]/edit.tsx`:

```tsx
import { Alert } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { loadTrail } from '../../../src/data/trails'
import { useTrailsStore } from '../../../src/store/trailsStore'
import { TrailForm } from '../../../src/trails/TrailForm'
import { useGoBackOrHome } from '../../../src/components/useGoBackOrHome'
import { ScreenHeader } from '../../../src/components/ScreenHeader'
import { LoadingScreen } from '../../../src/components/LoadingScreen'
import { useLoadedEntity } from '../../../src/components/useLoadedEntity'

export default function EditTrailScreen() {
  const leave = useGoBackOrHome()
  const params = useLocalSearchParams<{ id: string }>()
  const id = Number(params.id)
  const updateTrail = useTrailsStore((s) => s.updateTrail)

  // A trail that is gone was deleted from under this screen, which needs no explanation; a failed
  // read does.
  const loaded = useLoadedEntity(id, loadTrail, {
    label: 'trail',
    onUnavailable: (reason) => {
      if (reason === 'error') {
        Alert.alert('Could not open this trail', 'Something went wrong. Please try again.')
      }
      leave()
    },
  })

  if (loaded.status !== 'ready') return <LoadingScreen />
  const trail = loaded.entity

  return (
    <>
      <ScreenHeader title="Edit Trail" onBack={leave} />
      <TrailForm
        metrics={trail.metrics}
        initialName={trail.name}
        initialDifficulty={trail.difficulty}
        initialDescription={trail.description ?? ''}
        submitLabel="Save changes"
        onSubmit={async ({ name, difficulty, description }) => {
          await updateTrail(id, { name, difficulty, description })
          leave()
        }}
      />
    </>
  )
}
```

The `ActivityIndicator` / `StyleSheet` / `View` imports, the `useTheme` call, the two `useState`s,
the `useEffect`, and the `styles` block are all gone.

- [ ] **Step 3: Verify**

Run: `npm run verify`
Expected: PASS. A `trail.metrics` error on possibly-null here means the destructuring trap above was
hit — keep `loaded` as an object.

- [ ] **Step 4: Commit**

```bash
git add src/components/LoadingScreen.tsx "app/trail/[id]/edit.tsx"
git commit -m "feat(trails): give the edit screen one spinner component and a visible failure path"
```

---

### Task 5: the two screens whose loads are not id-keyed

**Files:**
- Modify: `app/activity/save.tsx:1-2`, `:17-44`, `:70-72`
- Modify: `app/trail/new.tsx:1-2`, `:10`, `:16`, `:59-65`, `:85-87`

**Interfaces:**
- Consumes: `LoadingScreen` (Task 4), `logEvent` from `src/log`.
- Produces: nothing for later tasks.

Neither screen gets the hook. `save.tsx` loads a singleton (`getActiveSession()`) plus a dependent
read and has no id to key to; `new.tsx` reads a file off a `uri` and parses GPX with two
domain-specific failures it already handles correctly. They share only the spinner — and `save.tsx`
is missing a failure path, which is the last of `ERR-3`'s four sites.

- [ ] **Step 1: Add the failure path and the shared spinner to `save.tsx`**

In `app/activity/save.tsx`, replace the first two import lines with:

```tsx
import { useEffect, useState } from 'react'
import { Alert } from 'react-native'
```

and add these two imports below the existing `ScreenHeader` import:

```tsx
import { LoadingScreen } from '../../src/components/LoadingScreen'
import { logEvent } from '../../src/log'
```

Replace the `useEffect` (lines 21-36) with:

```tsx
  useEffect(() => {
    let active = true
    void activitiesRepository
      .getActiveSession()
      .then(async (loaded) => {
        if (!active) return
        // No active session is the normal path back from a save or a discard elsewhere, not a failure.
        if (!loaded) {
          goToMap()
          return
        }
        const loadedPoints = await activitiesRepository.getSessionPoints(loaded.id)
        if (!active) return
        setSession(loaded)
        setSegments(groupPointsBySegment(loadedPoints))
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (!active) return
        logEvent('error', 'error', 'save screen load failed', { error: String(err) })
        Alert.alert('Could not open this recording', 'Something went wrong. Please try again.')
        goToMap()
      })
    return () => {
      active = false
    }
  }, [goToMap])
```

Replace the spinner block (lines 38-44) with:

```tsx
  if (loading || !session) return <LoadingScreen />
```

Delete the trailing `styles` block (lines 70-72) and the now-unused `useTheme` import and `const c =
useTheme()` line.

- [ ] **Step 2: Use the shared spinner in `new.tsx`**

In `app/trail/new.tsx`: change line 2 to `import { Alert } from 'react-native'`, delete the `useTheme`
import (line 10) and the `const c = useTheme()` line (line 16), add

```tsx
import { LoadingScreen } from '../../src/components/LoadingScreen'
```

below the existing `ScreenHeader` import, replace the spinner block (lines 59-65) with

```tsx
  if (loading || !metrics || !geometry) return <LoadingScreen />
```

and delete the trailing `styles` block (lines 85-87). Change nothing about the `useEffect`: its
`GpxError` handling is already correct and is deliberately out of scope.

- [ ] **Step 3: Verify**

Run: `npm run verify`
Expected: PASS, and the duplication test in particular — the three identical `styles.center` blocks
it was shadowing are now one component.

- [ ] **Step 4: Commit**

```bash
git add app/activity/save.tsx app/trail/new.tsx
git commit -m "fix(activities): surface a failed save-screen load instead of spinning forever"
```

---

### Task 6: `newTrailHref`

**Files:**
- Create: `src/trails/newTrailHref.ts`
- Test: `src/trails/__tests__/newTrailHref.test.ts`
- Modify: `src/trails/useIncomingShare.ts:12,21`
- Modify: `app/+native-intent.ts:3`
- Modify: `app/(tabs)/trails.tsx:73`

**Interfaces:**
- Consumes: nothing.
- Produces: `newTrailHref(uri: string, name?: string | null): string`.

- [ ] **Step 1: Write the failing test**

Create `src/trails/__tests__/newTrailHref.test.ts`:

```ts
import { newTrailHref } from '../newTrailHref'

describe('newTrailHref', () => {
  test('encodes a content uri into the uri param', () => {
    expect(newTrailHref('content://downloads/42')).toBe(
      '/trail/new?uri=content%3A%2F%2Fdownloads%2F42',
    )
  })

  test('encodes a space as %20, not as +', () => {
    expect(newTrailHref('file:///tmp/Col du Palet.gpx')).toBe(
      '/trail/new?uri=file%3A%2F%2F%2Ftmp%2FCol%20du%20Palet.gpx',
    )
  })

  test('encodes characters that would otherwise split the query', () => {
    expect(newTrailHref('file:///a&b#c.gpx')).toBe('/trail/new?uri=file%3A%2F%2F%2Fa%26b%23c.gpx')
  })

  test('appends an encoded name when one is given', () => {
    expect(newTrailHref('file:///a.gpx', 'Col du Palet')).toBe(
      '/trail/new?uri=file%3A%2F%2F%2Fa.gpx&name=Col%20du%20Palet',
    )
  })

  test('omits an empty name', () => {
    expect(newTrailHref('file:///a.gpx', '')).toBe('/trail/new?uri=file%3A%2F%2F%2Fa.gpx')
  })

  test('omits a null name', () => {
    expect(newTrailHref('file:///a.gpx', null)).toBe('/trail/new?uri=file%3A%2F%2F%2Fa.gpx')
  })

  test('omits an absent name', () => {
    expect(newTrailHref('file:///a.gpx', undefined)).toBe('/trail/new?uri=file%3A%2F%2F%2Fa.gpx')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/trails/__tests__/newTrailHref.test.ts`
Expected: FAIL — `Cannot find module '../newTrailHref'`.

- [ ] **Step 3: Write the implementation**

Create `src/trails/newTrailHref.ts`:

```ts
// A plain string because app/+native-intent.ts is contractually a string-returning function, and
// encodeURIComponent rather than URLSearchParams, which form-encodes a space as '+'.
export function newTrailHref(uri: string, name?: string | null): string {
  const query = `uri=${encodeURIComponent(uri)}`
  return name ? `/trail/new?${query}&name=${encodeURIComponent(name)}` : `/trail/new?${query}`
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/trails/__tests__/newTrailHref.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Point all four call sites at it**

In `src/trails/useIncomingShare.ts`, add `import { newTrailHref } from './newTrailHref'` and replace
both pushes:

```ts
      router.push(newTrailHref(uri))
```
```ts
    if (uri) router.push(newTrailHref(uri))
```

In `app/+native-intent.ts`:

```ts
import { newTrailHref } from '../src/trails/newTrailHref'

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  if (path.startsWith('content://') || path.startsWith('file://')) {
    return newTrailHref(path)
  }
  return path
}
```

In `app/(tabs)/trails.tsx`, add `import { newTrailHref } from '../../src/trails/newTrailHref'` and
replace line 73 (`router.push({ pathname: '/trail/new', params: { … } })`) with:

```tsx
    router.push(newTrailHref(asset.uri, fallback))
```

This moves that site from the object form to the string form. It is equivalent: `fallback` is
`string | undefined`, and an omitted `name` still lands as `''` through `new.tsx`'s own
`parsed.title ?? params.name ?? ''`.

- [ ] **Step 6: Verify**

Run: `npm run verify`
Expected: PASS — 542 tests (535 + 7).

- [ ] **Step 7: Commit**

```bash
git add src/trails/newTrailHref.ts src/trails/__tests__/newTrailHref.test.ts src/trails/useIncomingShare.ts app/+native-intent.ts "app/(tabs)/trails.tsx"
git commit -m "refactor(trails): build the new-trail href in one place"
```

---

### Task 7: record it in the backlog

**Files:**
- Modify: `docs/reviews/2026-09-10-full-review.md` — row 6 of the table, and the `DUP-3`, `DUP-4`,
  `ERR-3` finding blocks.

**Interfaces:** none.

- [ ] **Step 1: Tick row 6**

Match the existing convention exactly, as rows 1-5 do: wrap the description in `~~strikethrough~~`
and end the row with `**done** — <short-sha>`. Use the merge or final commit sha of this work.

- [ ] **Step 2: Correct the two stale claims, in place**

The review is a living record and must not be left asserting things that are no longer true:

- In `DUP-4`, the back-header-button clause is obsolete: `src/components/ScreenHeader.tsx:16-18`
  already owns that `Pressable` and its `accessibilityLabel`, and both named sites route through it.
  Say so rather than deleting the clause, so the record shows it was checked.
- In `DUP-3`, "exists five times" was wrong: three sites are id-keyed loads and two
  (`app/activity/save.tsx`, a singleton load; `app/trail/new.tsx`, a file parse) are a different
  shape that took only `LoadingScreen`. Record the corrected count and why the other two were left
  with their own load bodies.
- In `ERR-3`, note that all four sites are covered: three through the hook's rejection branch and
  `save.tsx` through its own `.catch`.

- [ ] **Step 3: Verify and commit**

Run: `npm run verify`
Expected: PASS.

```bash
git add docs/reviews/2026-09-10-full-review.md
git commit -m "docs(reviews): close backlog item 6 and correct two stale claims in its findings"
```

---

## Device checklist (the user's step — never claimed on their behalf)

1. Open a trail from the list and edit it — spinner, then the form. Save changes; the list shows them.
2. Record, stop, and reach the save screen — spinner, then the form. Try it twice: once saving, once
   discarding.
3. Import a GPX by share *and* by document picker, and one malformed file (expect the right alert of
   the two, and a return to where you came from).
4. Select a trail on the map, then an activity — each sheet appears with its content.
5. Open an activity that has a linked trail and follow the "View linked trail" link.
6. With a trail selected on the map, delete that trail from the Trails tab: the selection clears
   rather than hanging. This is the `missing` path, and Settings → Debug log should carry a
   `trail not found` entry at `warn`.
