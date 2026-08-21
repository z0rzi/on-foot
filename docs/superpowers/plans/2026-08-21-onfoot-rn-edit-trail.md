# Edit Trail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user edit an existing trail's name, difficulty, and description from the Trails list via a pencil icon that opens the create form pre-filled.

**Architecture:** Extract the create form UI into a presentational `TrailForm` component that both a create screen (`app/trail/new.tsx`, keeps its GPX load) and a new edit screen (`app/trail/[id]/edit.tsx`, loads the trail) render. Add `updateTrail` through the repository → store, backed by a pure `updateToValues` mapper that writes only the editable columns plus `updatedAt`.

**Tech Stack:** Expo SDK 57 (expo-router typed routes), React Native, TypeScript, Zustand, drizzle-orm + expo-sqlite, Jest.

## Global Constraints

- **No quick-fixes.** Fix at the right layer; follow existing patterns exactly (per `AGENTS.md`).
- **No change-narrating comments.** Comments describe current state only, not edits.
- **Pure logic is TDD'd; native rendering is device-verified.** Only `updateToValues` gets a Jest test; the form, route, and pencil are verified on-device.
- **No schema change / no migration.** Editing writes only existing columns.
- **Persist the minimum.** No new persisted state.
- **Editable fields are exactly:** `name`, `difficulty`, `description`. Metrics and geometry stay read-only.
- **Gate commands:** `npx tsc --noEmit` clean and `npx jest` green after every task.

---

### Task 1: Data-layer type + `updateToValues` mapper

**Files:**
- Modify: `src/data/trails/types.ts`
- Modify: `src/data/trails/mapping.ts`
- Test: `src/data/trails/__tests__/mapping.test.ts`

**Interfaces:**
- Consumes: existing `Difficulty` type from `src/data/trails/types.ts`.
- Produces:
  - `TrailUpdate = { name: string; difficulty: Difficulty; description: string | null }` (in `types.ts`)
  - `TrailUpdateValues = { name: string; difficulty: string; description: string | null; updatedAt: number }` (in `mapping.ts`)
  - `updateToValues(update: TrailUpdate, now: number): TrailUpdateValues` (in `mapping.ts`)

- [ ] **Step 1: Write the failing test**

Add to `src/data/trails/__tests__/mapping.test.ts` (the file already imports from `../mapping` on line 1 — extend that import to include `updateToValues`, and add `TrailUpdate` to the `../types` import on line 2):

```ts
test('updateToValues maps editable fields and stamps updatedAt only', () => {
  const update: TrailUpdate = { name: 'Renamed', difficulty: 'medium', description: 'now with notes' }
  const v = updateToValues(update, 999)
  expect(v).toEqual({
    name: 'Renamed', difficulty: 'medium', description: 'now with notes', updatedAt: 999,
  })
})

test('updateToValues carries a null description through', () => {
  const v = updateToValues({ name: 'A', difficulty: 'easy', description: null }, 5)
  expect(v.description).toBeNull()
})

test('updateToValues never emits createdAt, geometry, or metric columns', () => {
  const v = updateToValues({ name: 'A', difficulty: 'hard', description: null }, 5)
  expect(v).not.toHaveProperty('createdAt')
  expect(v).not.toHaveProperty('geometry')
  expect(v).not.toHaveProperty('distanceMeters')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/data/trails/__tests__/mapping.test.ts`
Expected: FAIL — `updateToValues` is not exported / not a function, and `TrailUpdate` is not a known type.

- [ ] **Step 3: Add the `TrailUpdate` type**

In `src/data/trails/types.ts`, add after the `NewTrailInput` interface:

```ts
export interface TrailUpdate {
  name: string
  difficulty: Difficulty
  description: string | null
}
```

- [ ] **Step 4: Add the value type + mapper**

In `src/data/trails/mapping.ts`, add `TrailUpdate` to the import on line 1 (`import { Difficulty, NewTrailInput, Trail, TrailGeometry, TrailSummary, TrailUpdate } from './types'`), then add at the end of the file:

```ts
export interface TrailUpdateValues {
  name: string
  difficulty: string
  description: string | null
  updatedAt: number
}

export function updateToValues(update: TrailUpdate, now: number): TrailUpdateValues {
  return {
    name: update.name,
    difficulty: update.difficulty,
    description: update.description,
    updatedAt: now,
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/data/trails/__tests__/mapping.test.ts`
Expected: PASS (all mapping tests, including the three new ones).

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/data/trails/types.ts src/data/trails/mapping.ts src/data/trails/__tests__/mapping.test.ts
git commit -m "feat: add TrailUpdate type and updateToValues mapper"
```

---

### Task 2: Repository + store `updateTrail`

**Files:**
- Modify: `src/data/trails/repository.ts`
- Modify: `src/data/db/trailsRepository.ts`
- Modify: `src/store/trailsStore.ts`

**Interfaces:**
- Consumes: `TrailUpdate` (types.ts), `updateToValues` (mapping.ts) from Task 1.
- Produces:
  - `TrailsRepository.updateTrail(id: number, update: TrailUpdate): Promise<void>`
  - `TrailsStore.updateTrail(id: number, update: TrailUpdate): Promise<void>` (calls repo then `loadTrails()`)

This task has no unit test (it touches the DB-backed repository and the store, which the codebase verifies on-device — `addTrail`/`createTrail` have no unit tests either). Its gate is `tsc` + the existing suite staying green; the behaviour is device-verified at the end of Task 5.

- [ ] **Step 1: Extend the repository interface**

In `src/data/trails/repository.ts`, add `TrailUpdate` to the import and a method to the interface:

```ts
import { NewTrailInput, Trail, TrailSummary, TrailUpdate } from './types'

export interface TrailsRepository {
  listSummaries(): Promise<TrailSummary[]>
  getTrail(id: number): Promise<Trail | null>
  createTrail(input: NewTrailInput): Promise<number>
  updateTrail(id: number, update: TrailUpdate): Promise<void>
  deleteTrail(id: number): Promise<void>
}
```

- [ ] **Step 2: Implement it in the SQLite repository**

In `src/data/db/trailsRepository.ts`, add `updateToValues` to the mapping import on line 3 (`import { inputToInsertValues, rowToSummary, rowToTrail, TrailRow, updateToValues } from '../trails/mapping'`), then add the method after `createTrail` (before `deleteTrail`):

```ts
  async updateTrail(id, update) {
    await db.update(trails).set(updateToValues(update, Date.now())).where(eq(trails.id, id))
  },
```

(`db`, `trails`, `eq` are already imported in this file.)

- [ ] **Step 3: Add the store action**

In `src/store/trailsStore.ts`, add `TrailUpdate` to the import from `../data/trails`, declare the action in the `TrailsStore` interface, and implement it mirroring `addTrail`:

Interface (add after `addTrail`):
```ts
  updateTrail: (id: number, update: TrailUpdate) => Promise<void>
```

Implementation (add after the `addTrail` action):
```ts
  updateTrail: async (id, update) => {
    await trailsRepository.updateTrail(id, update)
    await get().loadTrails()
  },
```

Import line becomes:
```ts
import { NewTrailInput, TrailSummary, TrailUpdate, trailsRepository } from '../data/trails'
```

- [ ] **Step 4: Typecheck and run the suite**

Run: `npx tsc --noEmit && npx jest`
Expected: no type errors; full suite green (no new tests, none broken).

- [ ] **Step 5: Commit**

```bash
git add src/data/trails/repository.ts src/data/db/trailsRepository.ts src/store/trailsStore.ts
git commit -m "feat: add updateTrail to repository and trails store"
```

---

### Task 3: Extract `TrailForm` component and refactor `new.tsx` to use it

**Files:**
- Create: `src/trails/TrailForm.tsx`
- Modify: `app/trail/new.tsx`

**Interfaces:**
- Consumes: `TrailMetrics`, `Difficulty` (types.ts); `MetricsRow` (`src/trails/MetricsRow.tsx`); `DifficultySelector` (`src/trails/DifficultySelector.tsx`); `useTheme` (`src/theme/useTheme`); `useTrailsStore` `addTrail` action.
- Produces:
  - `TrailFormValues = { name: string; difficulty: Difficulty; description: string | null }`
  - `TrailForm` component with props `{ metrics, initialName, initialDifficulty, initialDescription, title, submitLabel, onSubmit }`.

This is presentational + a screen refactor — device-verified. The gate is `tsc` clean, `jest` green, and the create flow visually unchanged on-device.

- [ ] **Step 1: Create the `TrailForm` component**

Create `src/trails/TrailForm.tsx` with exactly this content (the form body, `canSave` rule, save handler, and styles are moved verbatim from the current `new.tsx`; the header title and button label become props, and saving is delegated to `onSubmit`):

```tsx
import { useCallback, useState } from 'react'
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Stack, useRouter } from 'expo-router'
import { Difficulty, TrailMetrics } from '../data/trails/types'
import { DifficultySelector } from './DifficultySelector'
import { MetricsRow } from './MetricsRow'
import { useTheme } from '../theme/useTheme'

export interface TrailFormValues {
  name: string
  difficulty: Difficulty
  description: string | null
}

export function TrailForm({
  metrics,
  initialName,
  initialDifficulty,
  initialDescription,
  title,
  submitLabel,
  onSubmit,
}: {
  metrics: TrailMetrics
  initialName: string
  initialDifficulty: Difficulty | null
  initialDescription: string
  title: string
  submitLabel: string
  onSubmit: (values: TrailFormValues) => Promise<void>
}) {
  const c = useTheme()
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [difficulty, setDifficulty] = useState<Difficulty | null>(initialDifficulty)
  const [description, setDescription] = useState(initialDescription)
  const [saving, setSaving] = useState(false)

  const canSave = name.trim().length > 0 && difficulty !== null && !saving

  const onSave = useCallback(async () => {
    if (difficulty === null) return
    setSaving(true)
    try {
      await onSubmit({
        name: name.trim(),
        difficulty,
        description: description.trim().length > 0 ? description.trim() : null,
      })
      router.back()
    } catch {
      Alert.alert('Could not save trail', 'Something went wrong while saving. Please try again.')
    } finally {
      setSaving(false)
    }
  }, [description, difficulty, name, onSubmit, router])

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen
        options={{
          headerShown: true,
          title,
          headerLeft: () => (
            <Pressable accessibilityLabel="Back" onPress={() => router.back()} hitSlop={8}>
              <Ionicons name="arrow-back" size={24} color={c.onSurface} />
            </Pressable>
          ),
        }}
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <MetricsRow metrics={metrics} />

          <Text style={[styles.label, { color: c.onSurface }]}>Name *</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Trail name"
            placeholderTextColor={c.onSurfaceVariant}
            style={[styles.input, { color: c.onSurface, borderColor: c.panelDivider }]}
          />

          <Text style={[styles.label, { color: c.onSurface }]}>Difficulty *</Text>
          <DifficultySelector value={difficulty} onChange={setDifficulty} />

          <Text style={[styles.label, { color: c.onSurface }]}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Optional"
            placeholderTextColor={c.onSurfaceVariant}
            multiline
            style={[styles.input, styles.multiline, { color: c.onSurface, borderColor: c.panelDivider }]}
          />

          <Pressable
            accessibilityLabel="Save trail"
            disabled={!canSave}
            onPress={onSave}
            style={[styles.save, { backgroundColor: c.controlAccent, opacity: canSave ? 1 : 0.5 }]}
          >
            {saving ? <ActivityIndicator color={c.surface} /> : <Text style={[styles.saveLabel, { color: c.surface }]}>{submitLabel}</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  label: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 16 },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  save: { marginTop: 12, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  saveLabel: { fontSize: 16, fontWeight: '700' },
})
```

- [ ] **Step 2: Rewrite `new.tsx` to load the GPX and render `TrailForm`**

Replace the entire contents of `app/trail/new.tsx` with:

```tsx
import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { readGpxFile } from '../../src/data/trails/gpx/readFile'
import { parseGpx } from '../../src/data/trails/gpx/parse'
import { computeMetrics } from '../../src/data/trails/gpx/metrics'
import { useTrailsStore } from '../../src/store/trailsStore'
import { TrailGeometry, TrailMetrics } from '../../src/data/trails/types'
import { TrailForm } from '../../src/trails/TrailForm'
import { useTheme } from '../../src/theme/useTheme'

export default function NewTrailScreen() {
  const c = useTheme()
  const router = useRouter()
  const params = useLocalSearchParams<{ uri?: string; name?: string }>()
  const addTrail = useTrailsStore((s) => s.addTrail)

  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState<TrailMetrics | null>(null)
  const [geometry, setGeometry] = useState<TrailGeometry | null>(null)
  const [name, setName] = useState('')

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!params.uri) {
        router.back()
        return
      }
      try {
        const xml = await readGpxFile(params.uri)
        const parsed = parseGpx(xml, params.name ?? null)
        if (cancelled) return
        setGeometry({ points: parsed.points, waypoints: parsed.waypoints })
        setMetrics(computeMetrics(parsed.points))
        setName(parsed.title ?? params.name ?? '')
        setLoading(false)
      } catch {
        if (!cancelled) {
          setLoading(false)
          router.back()
        }
      }
    }
    run()
    return () => { cancelled = true }
  }, [params.uri, params.name, router])

  if (loading || !metrics || !geometry) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <ActivityIndicator size="large" color={c.controlAccent} />
      </View>
    )
  }

  return (
    <TrailForm
      metrics={metrics}
      initialName={name}
      initialDifficulty={null}
      initialDescription=""
      title="New Trail"
      submitLabel="I'm done"
      onSubmit={async ({ name: submittedName, difficulty, description }) => {
        await addTrail({ name: submittedName, difficulty, description, metrics, geometry })
      }}
    />
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})
```

Note: `metrics` and `geometry` are narrowed to non-null by the early-return guard, so the `onSubmit` closure passes them to `addTrail` without a null check.

- [ ] **Step 3: Typecheck and run the suite**

Run: `npx tsc --noEmit && npx jest`
Expected: no type errors; full suite green.

- [ ] **Step 4: Commit**

```bash
git add src/trails/TrailForm.tsx app/trail/new.tsx
git commit -m "refactor: extract TrailForm from new-trail screen"
```

---

### Task 4: Edit route `app/trail/[id]/edit.tsx`

**Files:**
- Create: `app/trail/[id]/edit.tsx`

**Interfaces:**
- Consumes: `trailsRepository.getTrail` (from `../../../src/data/trails` barrel — same import site as `src/map/useSelectedTrail.ts`), `Trail` type, `TrailForm` (Task 3), `useTrailsStore` `updateTrail` (Task 2), `useTheme`.
- Produces: the `/trail/[id]/edit` route (an `id` route param).

Device-verified.

- [ ] **Step 1: Create the edit screen**

Create `app/trail/[id]/edit.tsx` with exactly this content (the trail load mirrors `src/map/useSelectedTrail.ts`, with a loading spinner and `router.back()` when the trail is missing):

```tsx
import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Trail, trailsRepository } from '../../../src/data/trails'
import { useTrailsStore } from '../../../src/store/trailsStore'
import { TrailForm } from '../../../src/trails/TrailForm'
import { useTheme } from '../../../src/theme/useTheme'

export default function EditTrailScreen() {
  const c = useTheme()
  const router = useRouter()
  const params = useLocalSearchParams<{ id: string }>()
  const id = Number(params.id)
  const updateTrail = useTrailsStore((s) => s.updateTrail)

  const [loading, setLoading] = useState(true)
  const [trail, setTrail] = useState<Trail | null>(null)

  useEffect(() => {
    let active = true
    trailsRepository.getTrail(id).then((loaded) => {
      if (!active) return
      if (!loaded) {
        router.back()
        return
      }
      setTrail(loaded)
      setLoading(false)
    })
    return () => { active = false }
  }, [id, router])

  if (loading || !trail) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <ActivityIndicator size="large" color={c.controlAccent} />
      </View>
    )
  }

  return (
    <TrailForm
      metrics={trail.metrics}
      initialName={trail.name}
      initialDifficulty={trail.difficulty}
      initialDescription={trail.description ?? ''}
      title="Edit Trail"
      submitLabel="Save changes"
      onSubmit={async ({ name, difficulty, description }) => {
        await updateTrail(id, { name, difficulty, description })
      }}
    />
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})
```

- [ ] **Step 2: Typecheck and run the suite**

Run: `npx tsc --noEmit && npx jest`
Expected: no type errors (expo-router picks up the new typed route); full suite green.

- [ ] **Step 3: Commit**

```bash
git add app/trail/[id]/edit.tsx
git commit -m "feat: add edit-trail route"
```

---

### Task 5: Pencil icon entry point

**Files:**
- Modify: `src/trails/TrailListItem.tsx`
- Modify: `app/(tabs)/trails.tsx`

**Interfaces:**
- Consumes: the `/trail/[id]/edit` route (Task 4).
- Produces: `TrailListItem` gains an `onEdit: (id: number) => void` prop.

Device-verified end-to-end (this task completes the feature).

- [ ] **Step 1: Add the `onEdit` prop and pencil button to `TrailListItem`**

In `src/trails/TrailListItem.tsx`, add `onEdit` to the props type and render a pencil `Pressable` immediately before the existing trash `Pressable`.

Props type becomes:
```tsx
}: {
  trail: TrailSummary
  onSelect: (id: number) => void
  onEdit: (id: number) => void
  onDelete: (id: number) => void
}) {
```

Add this `Pressable` directly before the existing `accessibilityLabel="Delete trail"` Pressable:
```tsx
      <Pressable accessibilityLabel="Edit trail" onPress={() => onEdit(trail.id)} hitSlop={8} style={styles.action}>
        <Ionicons name="create-outline" size={22} color={c.onSurfaceVariant} />
      </Pressable>
```

Rename the existing `delete` style to `action` and reuse it for both buttons — change the trash Pressable's `style={styles.delete}` to `style={styles.action}`, and rename the style key:
```tsx
  action: { padding: 8, marginLeft: 4 },
```
(Replace the `delete: { padding: 8, marginLeft: 4 },` entry in `StyleSheet.create`.)

- [ ] **Step 2: Wire `onEdit` from the Trails screen**

In `app/(tabs)/trails.tsx`, pass `onEdit` to `TrailListItem` in the `renderItem` (line ~80):

```tsx
            <TrailListItem
              trail={item}
              onSelect={onSelect}
              onEdit={(id) => router.push(`/trail/${id}/edit`)}
              onDelete={() => confirmDelete(item)}
            />
```

`router` is already in scope in this component.

- [ ] **Step 3: Typecheck and run the suite**

Run: `npx tsc --noEmit && npx jest`
Expected: no type errors; full suite green.

- [ ] **Step 4: Commit**

```bash
git add src/trails/TrailListItem.tsx app/(tabs)/trails.tsx
git commit -m "feat: add pencil edit button to trail list items"
```

- [ ] **Step 5: Device verification (manual, on phone SWWC4HEIYHZPQWZX)**

With Metro running (`adb reverse` in place), on device:
1. Open Trails → each row shows a pencil next to the trash icon.
2. Tap the pencil → the form opens pre-filled with that trail's name, difficulty, description, and its metrics (read-only), header reads "Edit Trail", button reads "Save changes".
3. Change name, difficulty, and description → tap "Save changes" → returns to the list; the row reflects the new name/difficulty; list order (created date) unchanged.
4. Re-open the editor → the saved values persist.
5. Regression: the "Add a GPX file" create flow still works and reads "New Trail" / "I'm done".

---

## Notes for the executor

- After all tasks, hand off to `superpowers:finishing-a-development-branch` to merge `feat/edit-trail` into `master` (confirm base with the user).
- The whole feature is on branch `feat/edit-trail`; the design spec is committed at `docs/superpowers/specs/2026-08-21-onfoot-rn-edit-trail-design.md`.
