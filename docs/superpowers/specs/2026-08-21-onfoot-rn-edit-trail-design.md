# Edit Trail — Design

## Goal

Let the user edit an existing trail's **name, difficulty, and description** from the
Trails list. A pencil icon next to each trail's trash icon opens the same form used to
create a trail, pre-filled with the trail's current values; the user changes what they
want and saves.

## Scope

- **Editable:** name, difficulty, description — exactly the three fields the create form
  exposes.
- **Read-only:** distance/elevation metrics and route geometry are GPX-derived and shown
  read-only, mirroring create. Re-attaching a GPX is explicitly out of scope.
- **No schema change / no migration:** editing only writes columns that already exist.

## Architecture

The current `app/trail/new.tsx` does two jobs: it loads and parses a GPX, then renders the
form. Edit needs the form but not the GPX load. Rather than branch a single screen on
`uri` vs `id`, the form UI is extracted into a presentational component that both a create
screen and an edit screen render. Each unit stays single-purpose (per `AGENTS.md`), and the
form is written once.

```
app/trail/new.tsx        loads GPX  → <TrailForm> → addTrail
app/trail/[id]/edit.tsx  loads trail→ <TrailForm> → updateTrail   (new)
src/trails/TrailForm.tsx presentational form (name/difficulty/description + MetricsRow)
```

## Data layer (pure logic — TDD'd)

- **`src/data/trails/types.ts`** — add:
  ```ts
  export interface TrailUpdate {
    name: string
    difficulty: Difficulty
    description: string | null
  }
  ```
- **`src/data/trails/mapping.ts`** — add a pure mapper and its value type:
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
  It emits only the editable columns plus `updatedAt`; `createdAt`, `geometry`, and the
  metric columns are never touched.
- **`src/data/trails/repository.ts`** — extend the interface:
  ```ts
  updateTrail(id: number, update: TrailUpdate): Promise<void>
  ```
- **`src/data/db/trailsRepository.ts`** — implement:
  ```ts
  async updateTrail(id, update) {
    await db.update(trails).set(updateToValues(update, Date.now())).where(eq(trails.id, id))
  }
  ```
- **`src/store/trailsStore.ts`** — add an action mirroring `addTrail`:
  ```ts
  updateTrail: (id: number, update: TrailUpdate) => Promise<void>
  // impl: await trailsRepository.updateTrail(id, update); await get().loadTrails()
  ```

## Shared form component — `src/trails/TrailForm.tsx` (device-verified)

Presentational; owns the editable-field state and the save affordance, but does no data
loading.

**Props:**
```ts
interface TrailFormProps {
  metrics: TrailMetrics
  initialName: string
  initialDifficulty: Difficulty | null
  initialDescription: string
  title: string
  submitLabel: string
  onSubmit: (values: { name: string; difficulty: Difficulty; description: string | null }) => Promise<void>
}
```

**Responsibilities (moved verbatim from `new.tsx`):**
- Local state seeded from the `initial*` props: `name`, `difficulty`, `description`, `saving`.
- `canSave = name.trim().length > 0 && difficulty !== null && !saving`.
- Renders the header (`Stack.Screen` with `title` + back button), `MetricsRow`, the
  name/difficulty/description inputs, and the submit `Pressable` labelled `submitLabel`.
- On submit: trims name; passes `description.trim() || null`; calls `onSubmit`; on success
  `router.back()`; on throw shows the existing `Alert.alert('Could not save trail', …)`.

## Route screens

- **`app/trail/new.tsx`** — keeps the GPX read/parse/compute effect. Once loaded, renders
  `<TrailForm title="New Trail" submitLabel="I'm done" metrics={metrics}
  initialName={name} initialDifficulty={null} initialDescription=""
  onSubmit={addTrail}>`. (The GPX-derived name becomes `initialName`.)
- **`app/trail/[id]/edit.tsx`** (new) — reads `id` from route params, loads the trail via
  `trailsRepository.getTrail(id)` in an effect with a loading spinner. If the trail is
  `null`, `router.back()`. Otherwise renders `<TrailForm title="Edit Trail"
  submitLabel="Save changes" metrics={trail.metrics} initialName={trail.name}
  initialDifficulty={trail.difficulty} initialDescription={trail.description ?? ''}
  onSubmit={(patch) => updateTrail(id, patch)}>`.

## Entry point — pencil icon

- **`src/trails/TrailListItem.tsx`** — add an `onEdit: (id: number) => void` prop and a
  pencil `Pressable` (`create-outline`, `accessibilityLabel="Edit trail"`) placed before
  the existing trash `Pressable`, styled to match it.
- **`app/(tabs)/trails.tsx`** — pass `onEdit={(id) => router.push(\`/trail/${id}/edit\`)}`
  to `TrailListItem`.

## Error handling

- Save failure: existing `Alert.alert('Could not save trail', 'Something went wrong while
  saving. Please try again.')`, shared through `TrailForm`.
- Edit route with a missing/deleted trail id: `router.back()` after the load resolves null.

## Testing

- **Unit (Jest, first):** `updateToValues` — maps the three fields, sets `updatedAt` to the
  passed `now`, and omits `createdAt`/`geometry`/metrics from its output.
- **Device-verified:** tap pencil → form opens pre-filled with current name/difficulty/
  description and the trail's metrics → change each field → Save changes → list reflects the
  update; created date (list ordering) unchanged. Also: create flow still works unchanged.
