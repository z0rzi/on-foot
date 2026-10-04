# Navigate to Trail Start — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a **Navigate to start** item to the trail sheet's ⋮ menu that hands the trail's first recorded point to whichever map app the user picks from Android's own chooser.

**Architecture:** A new `src/external/` leaf owns the outward hand-off — a pure `geoUri` builder plus `openMapApp`, the single module permitted to import `expo-linking`, enforced by a new `external-apps` entry in `src/architecture/seams.ts`. Because the ⋮ menu is offline-only today, `OfflineActionsMenu` is first generalised into `src/components/ActionsMenu.tsx`; `TrailInfoSheet` then composes `[navigate, ...offlineMenuItems(state)]`.

**Tech Stack:** React Native 0.86 / Expo SDK 57, TypeScript, Jest (`jest-expo` preset), `expo-linking`, Zustand, `expo-sqlite` debug log.

**Design spec:** `docs/superpowers/specs/2026-10-02-onfoot-rn-navigate-to-trail-start-design.md`

## Global Constraints

Every task's requirements implicitly include all of these. Values are copied verbatim from the spec — do not paraphrase user-visible copy.

- **Menu item label:** `'Navigate to start'`, and it is the **first** item, above the offline items.
- **Failure toast:** `'No map app found'`, shown exactly once.
- **⋮ accessibility label:** `'Trail actions'` (was `'Offline actions'`).
- **URI shape:** `geo:<lat>,<lng>?q=<lat>,<lng>(<label>)`, coordinates at **six** decimals.
- **Log lines:** `logEvent('info', 'map', 'handed destination to the OS chooser')` on success; `logEvent('warn', 'map', 'map app launch failed', { error: String(error) })` on failure. Lowercase message, `String(error)` detail — the log's existing convention (`src/recording/recordingController.ts:43`).
- **The debug log never records coordinates.** No latitude or longitude in any message or detail.
- **`expo-linking` may be imported by `src/external/` only.** Never React Native's `Linking`: its specifier is `react-native`, which every component imports, so the seam could not enforce it.
- **No new `any` / `as any` / `@ts-ignore` / `eslint-disable`** without a one-line justification.
- **Expo docs are version-pinned:** consult `https://docs.expo.dev/versions/v57.0.0/` only, never the `latest` docs.
- **Test command inside this worktree:** the repo's `testPathIgnorePatterns` contains `/.claude/worktrees/`, so plain `npm run verify` / `npx jest` collects **zero** tests here and reports green regardless. Always run:
  - whole suite — `npx jest --testPathIgnorePatterns=/node_modules/`
  - one file — `npx jest <path> --testPathIgnorePatterns=/node_modules/` — **path first**, because `--testPathIgnorePatterns` is an array option and swallows a trailing path as a second ignore pattern, silently excluding the file you meant to run.
- **Types and lint** still run normally here: `npx tsc --noEmit` and `npm run lint`.
- **Do not run `npm install` in this worktree.** It has no `node_modules` of its own and does not need one: being nested inside the main checkout, Node resolution walks up and finds the parent's. `expo-linking@~57.0.6` is already a direct dependency, so **no task changes `package.json`**.
- **Verified API, do not re-derive:** `expo-linking`'s main entry declares `export declare function openURL(url: string): Promise<true>` (`node_modules/expo-linking/build/Linking.d.ts:59`), so `import { openURL } from 'expo-linking'` is correct.

## File Structure

| File | Responsibility |
|------|----------------|
| `src/external/geoUri.ts` (create) | Pure: a destination + label → a `geo:` URI. Owns coordinate precision and label encoding. Exports `Destination`. |
| `src/external/openMapApp.ts` (create) | The launch: the app's only `expo-linking` import, plus the success log, failure log and failure toast. |
| `src/external/index.ts` (create) | Barrel, following `src/log/index.ts`. |
| `src/map/geo.ts` (modify) | Add `startPointOf` beside `overallEndpoints`. |
| `src/components/actionItem.ts` (create) | The `ActionItem` contract, in a `.ts` so pure modules need not depend on a `.tsx` — following `src/components/enumField.ts`. |
| `src/components/ActionsMenu.tsx` (create, moved) | Domain-free ⋮ menu, consuming `ActionItem`. |
| `src/map/offline/OfflineActionsMenu.tsx` (delete) | Replaced by the above. |
| `src/trails/trailActions.ts` (create) | Pure builder composing `[navigate, ...offline]`, beside the `offlineMenuItems` precedent. |
| `src/trails/TrailInfoSheet.tsx` (modify) | Calls the builder; relabels the ⋮. |
| `src/architecture/seams.ts` (modify) | The `external-apps` seam. |
| `docs/architecture/seams.md` (modify) | The new row in *Seams enforced today*. |

Task order matters: the menu move (Task 4) lands before the wiring (Task 5) so the wiring imports the final name once.

---

### Task 1: `startPointOf` — the trail's first recorded point

**Files:**
- Modify: `src/map/geo.ts` (append after `overallEndpoints`, which ends at line 50)
- Test: `src/map/__tests__/geo.test.ts` (add an import and a `describe` block)

**Interfaces:**
- Consumes: `GpxPoint` from `src/data/trails/types` — `{ lat: number; lng: number; ele: number | null }`, already imported at the top of `geo.ts`.
- Produces: `startPointOf(segments: GpxPoint[][]): GpxPoint | null`. Task 5 calls it.

Why it returns a `GpxPoint` and not the `[lng, lat]` tuple the rest of `geo.ts` yields: those tuples exist because the map SDK consumes GeoJSON order, and a `geo:` URI wants the opposite order. Handing a positional pair across that reversal is a coordinate swap waiting to happen, so the one consumer outside map rendering gets named fields.

- [ ] **Step 1: Write the failing test**

Add `startPointOf` to the existing import block at the top of `src/map/__tests__/geo.test.ts` (it currently imports `boundsForPoints, toLineCoordinates, segmentLines, connectorLines, overallEndpoints, flattenSegments` from `'../geo'`). The file already defines the helper `const p = (lat: number, lng: number): GpxPoint => ({ lat, lng, ele: null })` — reuse it. Append:

```ts
describe('startPointOf', () => {
  test('no segments -> null', () => {
    expect(startPointOf([])).toBeNull()
  })
  test('only empty segments -> null', () => {
    expect(startPointOf([[], []])).toBeNull()
  })
  test('skips a leading empty segment', () => {
    expect(startPointOf([[], [p(45, 6), p(46, 7)]])).toEqual(p(45, 6))
  })
  test('returns the first point of the first non-empty segment, lat and lng unswapped', () => {
    const start = startPointOf([[p(45.5, 6.25), p(46, 7)], [p(47, 8)]])
    expect(start).toEqual({ lat: 45.5, lng: 6.25, ele: null })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/map/__tests__/geo.test.ts --testPathIgnorePatterns=/node_modules/`

Expected: FAIL — TypeScript/Jest reports `startPointOf` is not exported by `../geo`.

- [ ] **Step 3: Write the minimal implementation**

Append to `src/map/geo.ts`, after `overallEndpoints`:

```ts
export function startPointOf(segments: GpxPoint[][]): GpxPoint | null {
  const nonEmpty = segments.filter((s) => s.length > 0)
  return nonEmpty.length === 0 ? null : nonEmpty[0][0]
}
```

This mirrors `overallEndpoints`'s own "skip empty segments" idiom deliberately — same file, same rule, same shape.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/map/__tests__/geo.test.ts --testPathIgnorePatterns=/node_modules/`

Expected: PASS — 16 tests (the existing 12 plus 4).

- [ ] **Step 5: Commit**

```bash
git add src/map/geo.ts src/map/__tests__/geo.test.ts
git commit -m "feat(map): resolve a trail's first recorded point with startPointOf"
```

---

### Task 2: `geoUri` — the destination URI

**Files:**
- Create: `src/external/geoUri.ts`
- Test: `src/external/__tests__/geoUri.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `export interface Destination { lat: number; lng: number }` and `geoUri(point: Destination, label: string): string`. Task 3 consumes both.

`Destination` is structural, so a `GpxPoint` (which adds `ele`) is assignable to it without conversion — that is how Task 5 passes `startPointOf`'s result straight through.

- [ ] **Step 1: Write the failing test**

Create `src/external/__tests__/geoUri.test.ts`:

```ts
import { geoUri } from '../geoUri'

describe('geoUri', () => {
  test('emits the coordinates twice: once as the path, once as the q= query', () => {
    expect(geoUri({ lat: 46.123456, lng: 6.654321 }, 'Col de Bise')).toBe(
      'geo:46.123456,6.654321?q=46.123456,6.654321(Col%20de%20Bise)',
    )
  })

  test('fixes coordinates at six decimals rather than emitting raw float noise', () => {
    expect(geoUri({ lat: 46.12345678901234, lng: 6.1 }, 'X')).toBe(
      'geo:46.123457,6.100000?q=46.123457,6.100000(X)',
    )
  })

  test('keeps the sign of southern and western coordinates', () => {
    expect(geoUri({ lat: -33.5, lng: -70.25 }, 'X')).toBe(
      'geo:-33.500000,-70.250000?q=-33.500000,-70.250000(X)',
    )
  })

  test('percent-encodes spaces and accents in the label', () => {
    expect(geoUri({ lat: 1, lng: 2 }, 'Pré du Lac')).toBe(
      'geo:1.000000,2.000000?q=1.000000,2.000000(Pr%C3%A9%20du%20Lac)',
    )
  })

  // encodeURIComponent leaves ( and ) alone, and the q= label syntax is parenthesis-delimited:
  // a trail named "Col de Bise (boucle)" would otherwise close the label early.
  test('encodes parentheses in the label so exactly one pair delimits it', () => {
    const uri = geoUri({ lat: 1, lng: 2 }, 'Col de Bise (boucle)')
    expect(uri).toBe('geo:1.000000,2.000000?q=1.000000,2.000000(Col%20de%20Bise%20%28boucle%29)')
    expect(uri.match(/\(/g)).toHaveLength(1)
    expect(uri.match(/\)/g)).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/external/__tests__/geoUri.test.ts --testPathIgnorePatterns=/node_modules/`

Expected: FAIL — `Cannot find module '../geoUri'`.

- [ ] **Step 3: Write the minimal implementation**

Create `src/external/geoUri.ts`:

```ts
export interface Destination {
  lat: number
  lng: number
}

const COORD_DECIMALS = 6

// encodeURIComponent leaves ( and ) untouched, and the q= label is parenthesis-delimited.
const encodeLabel = (label: string): string =>
  encodeURIComponent(label).replace(/\(/g, '%28').replace(/\)/g, '%29')

// The coordinates appear twice on purpose: apps that read only the geo: path still get the point,
// apps that read q= get the point and the trail's name on the pin.
export function geoUri(point: Destination, label: string): string {
  const coords = `${point.lat.toFixed(COORD_DECIMALS)},${point.lng.toFixed(COORD_DECIMALS)}`
  return `geo:${coords}?q=${coords}(${encodeLabel(label)})`
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/external/__tests__/geoUri.test.ts --testPathIgnorePatterns=/node_modules/`

Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/external/geoUri.ts src/external/__tests__/geoUri.test.ts
git commit -m "feat(external): build a geo: destination URI with encoded label and fixed precision"
```

---

### Task 3: `openMapApp` and the `external-apps` seam

The seam entry ships **in this task, not later** — AGENTS.md requires a new boundary to be registered in `seams.ts` in the same change that introduces it. The scanner skips `__tests__` directories, so the test file's `jest.mock('expo-linking', …)` is not a seam violation.

**Files:**
- Create: `src/external/openMapApp.ts`
- Create: `src/external/index.ts`
- Modify: `src/architecture/seams.ts` (append to the `SEAMS` array, after the `location` entry ending at line 36)
- Modify: `src/architecture/__tests__/seams.test.ts` (add one case alongside `flags the location SDK outside src/location`)
- Modify: `docs/architecture/seams.md` (one row in the *Seams enforced today* table, which ends with the `location` row)
- Test: `src/external/__tests__/openMapApp.test.ts`

**Interfaces:**
- Consumes: `geoUri`, `Destination` from Task 2. `showToast(message: string): void` from `src/components/toast`. `logEvent(level, area, message, detail?): void` from `src/log`, where `level` is `'info' | 'warn' | …` and `area` is `'recording' | 'capture' | 'launch' | 'map' | 'error'` — `'map'` is the right area and **no new `LogArea` value is needed**.
- Produces: `openMapApp(point: Destination, label: string): Promise<void>`. It **never rejects** — Task 5 calls it as `void openMapApp(...)` and an unhandled rejection there would crash in dev.

- [ ] **Step 1: Write the failing test**

Create `src/external/__tests__/openMapApp.test.ts`. The mock-then-import-then-`jest.mocked` order is the codebase's established idiom (`src/recording/__tests__/locationTask.test.ts:1-15`):

```ts
jest.mock('expo-linking', () => ({ openURL: jest.fn() }))
jest.mock('../../log', () => ({ logEvent: jest.fn() }))
jest.mock('../../components/toast', () => ({ showToast: jest.fn() }))

import { openURL } from 'expo-linking'
import { logEvent } from '../../log'
import { showToast } from '../../components/toast'
import { openMapApp } from '../openMapApp'
import { geoUri } from '../geoUri'

const opened = jest.mocked(openURL)
const logged = jest.mocked(logEvent)
const toasted = jest.mocked(showToast)

const point = { lat: 45.5, lng: 6.25 }

beforeEach(() => {
  opened.mockReset()
  logged.mockClear()
  toasted.mockClear()
})

describe('openMapApp', () => {
  test('hands the geo: URI to the linking SDK and logs the hand-off', async () => {
    opened.mockResolvedValue(true)
    await openMapApp(point, 'Col de Bise')
    expect(opened).toHaveBeenCalledWith(geoUri(point, 'Col de Bise'))
    expect(logged).toHaveBeenCalledWith('info', 'map', 'handed destination to the OS chooser')
    expect(toasted).not.toHaveBeenCalled()
  })

  // On Android a rejection means no activity handled the intent: startActivity has already
  // resolved by the time the chooser is drawn, so the message can name the actual cause.
  test('reports exactly once when no app handles the intent', async () => {
    opened.mockRejectedValue(new Error('No Activity found to handle Intent'))
    await openMapApp(point, 'Col de Bise')
    expect(toasted).toHaveBeenCalledTimes(1)
    expect(toasted).toHaveBeenCalledWith('No map app found')
    expect(logged).toHaveBeenCalledWith('warn', 'map', 'map app launch failed', {
      error: 'Error: No Activity found to handle Intent',
    })
  })

  test('resolves rather than rejecting, so a fire-and-forget caller cannot raise', async () => {
    opened.mockRejectedValue(new Error('nope'))
    await expect(openMapApp(point, 'Col de Bise')).resolves.toBeUndefined()
  })

  test('keeps coordinates out of the debug log', async () => {
    opened.mockResolvedValue(true)
    await openMapApp(point, 'Col de Bise')
    opened.mockRejectedValue(new Error('nope'))
    await openMapApp(point, 'Col de Bise')
    const written = JSON.stringify(logged.mock.calls)
    expect(written).not.toContain('45.5')
    expect(written).not.toContain('6.25')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/external/__tests__/openMapApp.test.ts --testPathIgnorePatterns=/node_modules/`

Expected: FAIL — `Cannot find module '../openMapApp'`.

- [ ] **Step 3: Write the minimal implementation**

Create `src/external/openMapApp.ts`:

```ts
import { openURL } from 'expo-linking'
import { showToast } from '../components/toast'
import { logEvent } from '../log'
import { geoUri, type Destination } from './geoUri'

// The app's single outward door: the only module that may hand a URL to another app. A geo: URI
// dispatches ACTION_VIEW, so Android's own chooser decides which map app receives the destination.
// No canOpenURL pre-check: on Android 11+ it returns false for any scheme absent from a <queries>
// manifest block, which Expo's config cannot declare without a custom plugin.
export async function openMapApp(point: Destination, label: string): Promise<void> {
  try {
    await openURL(geoUri(point, label))
    logEvent('info', 'map', 'handed destination to the OS chooser')
  } catch (error) {
    logEvent('warn', 'map', 'map app launch failed', { error: String(error) })
    showToast('No map app found')
  }
}
```

Create `src/external/index.ts`:

```ts
export { openMapApp } from './openMapApp'
export type { Destination } from './geoUri'
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/external/__tests__/openMapApp.test.ts --testPathIgnorePatterns=/node_modules/`

Expected: PASS — 4 tests.

- [ ] **Step 5: Register the seam**

Append to the `SEAMS` array in `src/architecture/seams.ts`, after the `location` entry:

```ts
  {
    name: 'external-apps',
    tokens: ['expo-linking'],
    allow: ['src/external/'],
    rationale:
      'Only src/external hands a URL to another app; features ask it to open a destination and never reach for the linking SDK.',
  },
```

Add this case to `src/architecture/__tests__/seams.test.ts`, after `flags the location SDK outside src/location`:

```ts
  test('flags the linking SDK outside src/external', () => {
    const files = [{ path: 'src/trails/TrailInfoSheet.tsx', content: "import { openURL } from 'expo-linking'" }]
    expect(findSeamViolations(files).some((v) => v.seam === 'external-apps')).toBe(true)
  })
```

- [ ] **Step 6: Run the seam tests to verify both the new case and the real scan pass**

Run: `npx jest src/architecture/__tests__/seams.test.ts --testPathIgnorePatterns=/node_modules/`

Expected: PASS — 8 tests. The first test (`no source file imports a seam token outside its allowed boundary`) is the one that matters: it scans the real `src` and `app` trees, and must stay green because `src/external/openMapApp.ts` is the only non-test file importing `expo-linking`.

- [ ] **Step 7: Document the seam**

Add this row to the end of the *Seams enforced today* table in `docs/architecture/seams.md` (currently last row: `location`):

```markdown
| `external-apps` | `expo-linking` | `src/external/` |
```

- [ ] **Step 8: Commit**

```bash
git add src/external/openMapApp.ts src/external/index.ts src/external/__tests__/openMapApp.test.ts \
        src/architecture/seams.ts src/architecture/__tests__/seams.test.ts docs/architecture/seams.md
git commit -m "feat(external): open a destination in the user's map app behind the external-apps seam"
```

---

### Task 4: Generalise the ⋮ menu into `ActionsMenu`

A pure move and rename — the implementation does not change. The component's props are already domain-free; what is offline-specific is its name, its folder and its header comment. This is its own task so a reviewer can accept or reject the generalisation independently of the feature.

**Files:**
- Create: `src/components/ActionsMenu.tsx` (moved from `src/map/offline/OfflineActionsMenu.tsx`)
- Delete: `src/map/offline/OfflineActionsMenu.tsx`
- Modify: `src/trails/TrailInfoSheet.tsx:25` and `:158` (its only consumer)

**Interfaces:**
- Produces: `ActionsMenu` and `export interface ActionItem { label: string; danger?: boolean; onPress: () => void }`. Task 5 types its composed list as `ActionItem[]`.

No unit test: this is native rendering, which the project verifies on device (Task 5's device checklist covers it). The compiler and the whole-suite run are the gate here.

- [ ] **Step 1: Move the file with history**

```bash
git mv src/map/offline/OfflineActionsMenu.tsx src/components/ActionsMenu.tsx
```

- [ ] **Step 2: Rename the component, export the item type, and fix the import depth**

Replace the contents of `src/components/ActionsMenu.tsx` with the following. Note `../../theme/useTheme` becomes `../theme/useTheme` — the file is one directory shallower now, and missing this is the one way this move breaks:

```tsx
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../theme/useTheme'

export interface ActionItem {
  label: string
  danger?: boolean
  onPress: () => void
}

// Rendered in a Modal so it escapes the bottom sheet and the tab bar (neither can clip it), then
// positioned so its bottom-right sits just above the anchor (the ⋮ button) — the menu opens upward.
export function ActionsMenu({
  items,
  anchor,
  onClose,
}: {
  items: ActionItem[]
  anchor: { x: number; y: number }
  onClose: () => void
}) {
  const c = useTheme()
  const win = Dimensions.get('window')
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close menu" />
      <View
        style={[
          styles.menu,
          { backgroundColor: c.surface, borderColor: c.panelDivider, right: win.width - anchor.x, bottom: win.height - anchor.y + 6 },
        ]}
      >
        {items.map((item) => (
          <Pressable
            key={item.label}
            accessibilityLabel={item.label}
            onPress={() => {
              onClose()
              item.onPress()
            }}
            style={styles.item}
          >
            <Text style={{ color: item.danger ? c.danger : c.panelContent, fontSize: 13 }}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  menu: {
    position: 'absolute', minWidth: 190, borderWidth: 1, borderRadius: 10, paddingVertical: 4,
    elevation: 8, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },
  item: { paddingVertical: 10, paddingHorizontal: 14 },
})
```

- [ ] **Step 3: Update the single consumer**

In `src/trails/TrailInfoSheet.tsx`, replace the import on line 25:

```ts
import { OfflineActionsMenu } from '../map/offline/OfflineActionsMenu'
```

with:

```ts
import { ActionsMenu } from '../components/ActionsMenu'
```

and the render near line 158:

```tsx
        <OfflineActionsMenu items={menuItems} anchor={menuAnchor} onClose={() => setMenuAnchor(null)} />
```

with:

```tsx
        <ActionsMenu items={menuItems} anchor={menuAnchor} onClose={() => setMenuAnchor(null)} />
```

- [ ] **Step 4: Verify nothing else referenced the old name, then typecheck**

```bash
grep -rn "OfflineActionsMenu" src app ; echo "exit: $status"
npx tsc --noEmit
```

Expected: the grep prints nothing (it had exactly one consumer), and `tsc` is silent.

- [ ] **Step 5: Run the whole suite**

Run: `npx jest --testPathIgnorePatterns=/node_modules/`

Expected: PASS, all suites — including `cycles`, `duplication` and `importRules`, which scan the moved file at its new path.

- [ ] **Step 6: Commit**

```bash
git add src/components/ActionsMenu.tsx src/map/offline/OfflineActionsMenu.tsx src/trails/TrailInfoSheet.tsx
git commit -m "refactor(components): generalise the offline ⋮ menu into a domain-free ActionsMenu"
```

---

### Task 5: Wire the item into the trail sheet

**Files:**
- Modify: `src/trails/TrailInfoSheet.tsx` — imports, the item composition at line 101, and the ⋮'s label at line 117

**Interfaces:**
- Consumes: `startPointOf` (Task 1), `openMapApp` (Task 3), `ActionItem` (Task 4), and the existing `offlineMenuItems(state)` + `handlers` record already in the file.
- Produces: nothing for later tasks. This is the last code task.

- [ ] **Step 1: Add the three imports**

In `src/trails/TrailInfoSheet.tsx`:

Add `startPointOf` to the existing `../map/geo` import on line 21, which currently reads `import { flattenSegments } from '../map/geo'`:

```ts
import { flattenSegments, startPointOf } from '../map/geo'
```

Add `ActionItem` to the `ActionsMenu` import from Task 4:

```ts
import { ActionsMenu, type ActionItem } from '../components/ActionsMenu'
```

And add, beside the other feature imports:

```ts
import { openMapApp } from '../external'
```

- [ ] **Step 2: Compose the item list with Navigate to start first**

Replace line 101:

```ts
  const menuItems = offlineMenuItems(state).map((item) => ({ ...item, onPress: handlers[item.action] }))
```

with:

```ts
  const start = startPointOf(trail.geometry.segments)
  const menuItems: ActionItem[] = [
    ...(start ? [{ label: 'Navigate to start', onPress: () => void openMapApp(start, trail.name) }] : []),
    ...offlineMenuItems(state).map((item) => ({ ...item, onPress: handlers[item.action] })),
  ]
```

Two things this spelling is doing deliberately:

- **The item is absent, not disabled, when `start` is `null`.** The no-route guard makes that unreachable for anything imported since 2026-09-10, but trails persisted before it can still hold empty segments, and an action that cannot work should not be offered. `start` being a `const` is what lets TypeScript keep the non-null narrowing inside the closure.
- **`void openMapApp(...)`** because `onPress` returns `void`. `openMapApp` never rejects (Task 3 pins that), so this cannot become an unhandled rejection.

- [ ] **Step 3: Relabel the ⋮**

On line 117, the ⋮ now opens more than offline actions:

```tsx
          <Pressable accessibilityLabel="Offline actions" onPress={openMenu} hitSlop={8}>
```

becomes:

```tsx
          <Pressable accessibilityLabel="Trail actions" onPress={openMenu} hitSlop={8}>
```

- [ ] **Step 4: Typecheck, lint and run the whole suite**

```bash
npx tsc --noEmit
npm run lint
npx jest --testPathIgnorePatterns=/node_modules/
```

Expected: all three clean. If `lint` flags the new `void` expression or the conditional spread, read the rule before reshaping the code — a justified one-line `eslint-disable` is a first-class outcome here, but only with an honest justification.

- [ ] **Step 5: Commit**

```bash
git add src/trails/TrailInfoSheet.tsx
git commit -m "feat(trails): offer Navigate to start in the trail actions menu"
```

---

### Task 6: Device verification

Pure-logic tasks are done; the chooser, the menu's rendering and the pin are device concerns and cannot be unit-tested. Build to a device and walk the list.

**Files:** none — this task changes no code. Any defect it finds reopens Task 5 (or Task 3 for a launch failure).

- [ ] **Step 1: Build and install**

```bash
npx expo run:android
```

If the app crashes at launch with a Mapbox error, `.env` is missing from the worktree — copy it from the main checkout and rebuild.

- [ ] **Step 2: Walk the verification list**

1. Open a trail's sheet and tap ⋮ — **Navigate to start** is the first item, above the offline items.
2. Tap it: Android's disambiguation dialog lists the installed map apps.
3. Pick Google Maps — the pin sits at the trailhead and carries the trail's name.
4. Pick a second app (Organic Maps or Waze) — the same point resolves there.
5. Back out of the chooser without choosing: **no toast appears** and the sheet is unchanged. (This is the one assumption the unit tests cannot prove — that Android resolves `openURL` before drawing the chooser. If a toast *does* appear here, the honest fix is to drop the toast's wording to something true in both cases, and the spec's *Consequences accepted* needs a new line.)
6. Settings → Debug log shows one `map` entry per hand-off, with no coordinates in it.
7. A trail in the `downloading`, `available` and `failed` offline states still shows its own items below the new one.
8. With a screen reader on, the ⋮ announces "Trail actions".
9. In the receiving map app, press Back — On Foot's trail sheet comes back, not the launcher. Without a `<queries>` manifest block `resolveActivity` returns null, so React Native adds `FLAG_ACTIVITY_NEW_TASK` and the map app starts in its own task; this step checks what that does to the back stack.

- [ ] **Step 3: Record the outcome**

Note any deviation from steps 1-9 in the session log before closing out. Steps 5, 6 and 9 are the ones that can invalidate a design decision rather than just reveal a bug.

---

## Self-Review

**Spec coverage** — every section of the spec maps to a task:

| Spec section | Task |
|---|---|
| 1. The URI (`geoUri`, six decimals, doubled coords, encoded parens) | 2 |
| 2. The launch (`openMapApp`, no `canOpenURL`, no `expo-intent-launcher`, no coords logged) | 3 |
| 3. The seam (`seams.ts` entry, `seams.md` row) | 3 |
| 4. The start point (`startPointOf`, `GpxPoint` not a tuple) | 1 |
| 5. The menu (`ActionsMenu` move, composition, item first, "Trail actions", absent when `null`) | 4, 5 |
| Test plan items 1-5 (`geoUri`) | 2 |
| Test plan items 6-8 (`openMapApp`) | 3 |
| Test plan items 9-12 (`startPointOf`) | 1 |
| Device verification 1-7 | 6 |

The spec's *Rejected alternatives* and *Consequences accepted* need no task; they are recorded as comments in the code they explain (Task 3's `openMapApp` header carries the `canOpenURL` reasoning).

**Placeholder scan:** none. Every code step carries the literal code; no "add error handling", no "similar to Task N".

**Type consistency:** `Destination` (Task 2) is consumed by `openMapApp` (Task 3) and satisfied structurally by `GpxPoint` from `startPointOf` (Task 1). `ActionItem` (Task 4) types the list in Task 5. `startPointOf` is spelled identically in Tasks 1 and 5; `openMapApp` in Tasks 3 and 5. `logEvent`'s `'map'` area exists in the current `LogArea` union, so no task touches the log schema.
