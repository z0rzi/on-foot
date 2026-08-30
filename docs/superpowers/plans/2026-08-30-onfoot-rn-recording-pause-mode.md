# Recording Pause Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a durable **paused** state to hike recording (hold-to-pause → Resume/Stop), with paused time excluded from moving-time stats, structurally fixing bug #18.

**Architecture:** Phase is derived purely from the durable session (`idle | recording | paused`), now keyed on a new `pausedAt` column plus an accumulated `pausedMs`. Pure session math (`movingElapsedMs`, `applyPause`, `applyResume`) is TDD'd; the controller is a thin persist+GPS wrapper; the map switches its bottom-left control between a hold-to-pause button (recording) and two floating Resume/Stop buttons (paused). `endedAt` is written only at the final save, so the map never sits in a dead "saving" state.

**Tech Stack:** Expo SDK 57, React Native, TypeScript, Zustand, expo-sqlite + drizzle-orm, react-native-gesture-handler, react-native-reanimated, Jest (jest-expo).

## Global Constraints

- **Persistence seam:** only `src/data/db/*` imports expo-sqlite/drizzle. New durable state goes through the `ActivitiesRepository` port and its sqlite implementation. Persist the minimum.
- **Map-provider seam:** unchanged in this slice — no map-SDK (`@rnmapbox/maps`) code is touched.
- **Pure logic is TDD'd; native rendering / GPS is device-verified.** State derivation and session transitions are pure Jest-first functions; location-task GPS behaviour, gestures, and control rendering are verified on-device.
- **No change-narrating comments.** Comments describe current state, not edits.
- **Branch:** `feat/recording-live-stats` — already checked out; continue on it. Do not branch or merge.
- **Keep every commit green:** `npx tsc --noEmit` clean and `npx jest` all-pass at each task boundary. Some intermediate tasks intentionally keep now-legacy code (`stopRecording`, `markStopped`, the `'save'` resume action) alive until the final cleanup task removes it.

---

### Task 1: Durable pause columns, session type, repository ports

Adds `paused_at` + `paused_ms` to the recording session end-to-end (schema → migration → type → mapping → repository), plus the three new repository writes. Purely **additive** on the repository — `markStopped` stays until Task 7.

**Files:**
- Modify: `src/data/db/schema.ts` (add two columns to `recordingSessions`)
- Generate: `src/data/db/migrations/0004_*.sql` + `migrations.js` + `meta/` (via `npm run db:generate`)
- Modify: `src/data/activities/types.ts:40-45` (`RecordingSession`)
- Modify: `src/data/activities/mapping.ts:38-43,81-83` (`RecordingSessionRow`, `rowToSession`)
- Modify: `src/data/activities/repository.ts` (interface: add three methods)
- Modify: `src/data/db/activitiesRepository.ts` (implement three methods)
- Modify: `src/recording/recordingController.ts:21` (`beginSession` literal)
- Test: `src/data/activities/__tests__/mapping.test.ts` (`rowToSession`)
- Compile-fix literals: `src/recording/__tests__/recordingStore.test.ts`, `src/recording/__tests__/resume.test.ts`, `src/data/activities/__tests__/mapping.test.ts`

**Interfaces:**
- Produces:
  - `RecordingSession` now has `pausedAt: number | null` and `pausedMs: number` (in addition to `id, startedAt, endedAt, linkedTrailId`).
  - `ActivitiesRepository.markPaused(sessionId: number, pausedAt: number): Promise<void>`
  - `ActivitiesRepository.markResumed(sessionId: number, pausedMs: number): Promise<void>` (also clears `paused_at` to null)
  - `ActivitiesRepository.markLinkedTrail(sessionId: number, linkedTrailId: number | null): Promise<void>`

- [ ] **Step 1: Extend the `rowToSession` test with the new fields**

In `src/data/activities/__tests__/mapping.test.ts`, replace the existing `rowToSession` describe block (around line 30) with:

```ts
describe('rowToSession', () => {
  it('maps a recording session row including pause fields', () => {
    expect(
      rowToSession({ id: 3, startedAt: 10, endedAt: null, linkedTrailId: null, pausedAt: null, pausedMs: 0 }),
    ).toEqual({ id: 3, startedAt: 10, endedAt: null, linkedTrailId: null, pausedAt: null, pausedMs: 0 })
  })
  it('maps a paused session row', () => {
    expect(
      rowToSession({ id: 3, startedAt: 10, endedAt: null, linkedTrailId: 2, pausedAt: 500, pausedMs: 120 }),
    ).toEqual({ id: 3, startedAt: 10, endedAt: null, linkedTrailId: 2, pausedAt: 500, pausedMs: 120 })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/data/activities/__tests__/mapping.test.ts -t rowToSession`
Expected: FAIL — `rowToSession` returns an object without `pausedAt`/`pausedMs` (and the `RecordingSessionRow` argument type errors under ts-jest).

- [ ] **Step 3: Add the columns to the schema**

In `src/data/db/schema.ts`, in the `recordingSessions` table definition, add two columns after `linkedTrailId` (before `singleton`):

```ts
    linkedTrailId: integer('linked_trail_id'),
    pausedAt: integer('paused_at'),
    pausedMs: integer('paused_ms').notNull().default(0),
    singleton: integer('singleton').notNull().default(1),
```

- [ ] **Step 4: Generate the migration**

Run: `npm run db:generate`
Expected: a new `src/data/db/migrations/0004_*.sql` is created (containing `ALTER TABLE recording_sessions ADD COLUMN paused_at ...` and `... paused_ms ...`), and `migrations.js` + `meta/_journal.json` are updated to include idx 4. Do not hand-edit these generated files.

- [ ] **Step 5: Extend `RecordingSession` and the row type + mapping**

In `src/data/activities/types.ts`, update `RecordingSession`:

```ts
export interface RecordingSession {
  id: number
  startedAt: number
  endedAt: number | null
  linkedTrailId: number | null
  pausedAt: number | null
  pausedMs: number
}
```

In `src/data/activities/mapping.ts`, update `RecordingSessionRow`:

```ts
export interface RecordingSessionRow {
  id: number
  startedAt: number
  endedAt: number | null
  linkedTrailId: number | null
  pausedAt: number | null
  pausedMs: number
}
```

and `rowToSession`:

```ts
export function rowToSession(row: RecordingSessionRow): RecordingSession {
  return {
    id: row.id,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    linkedTrailId: row.linkedTrailId,
    pausedAt: row.pausedAt,
    pausedMs: row.pausedMs,
  }
}
```

- [ ] **Step 6: Add the three repository methods (interface + sqlite)**

In `src/data/activities/repository.ts`, inside the `ActivitiesRepository` interface, keep `markStopped` and add:

```ts
  markPaused(sessionId: number, pausedAt: number): Promise<void>
  markResumed(sessionId: number, pausedMs: number): Promise<void>
  markLinkedTrail(sessionId: number, linkedTrailId: number | null): Promise<void>
```

In `src/data/db/activitiesRepository.ts`, add implementations (place them next to `markStopped`):

```ts
  async markPaused(sessionId, pausedAt) {
    await db.update(recordingSessions).set({ pausedAt }).where(eq(recordingSessions.id, sessionId))
  },
  async markResumed(sessionId, pausedMs) {
    await db.update(recordingSessions).set({ pausedAt: null, pausedMs }).where(eq(recordingSessions.id, sessionId))
  },
  async markLinkedTrail(sessionId, linkedTrailId) {
    await db.update(recordingSessions).set({ linkedTrailId }).where(eq(recordingSessions.id, sessionId))
  },
```

- [ ] **Step 7: Fix the `beginSession` construction site**

In `src/recording/recordingController.ts:21`, the `beginSession` call now needs the new required fields:

```ts
  useRecordingStore.getState().beginSession({ id: sessionId, startedAt, endedAt: null, linkedTrailId: null, pausedAt: null, pausedMs: 0 })
```

- [ ] **Step 8: Fix remaining `RecordingSession` literals so tsc + jest stay green**

Add `pausedAt: null, pausedMs: 0` to every `RecordingSession`/`RecordingSessionRow` object literal the compiler now rejects. Known sites (later tasks rewrite the assertions, this step is only the mechanical compile-fix):
- `src/recording/__tests__/recordingStore.test.ts` — the `recordingSession` and `stoppedSession` literals.
- `src/recording/__tests__/resume.test.ts` — the two inline session literals.
- `src/data/activities/__tests__/mapping.test.ts` — the `session` literal used by the `buildNewActivityInput` tests (add the two fields).

Find them:

```bash
npx tsc --noEmit 2>&1 | grep -E "pausedAt|pausedMs|RecordingSession"
```

- [ ] **Step 9: Run tsc + jest to verify green**

Run: `npx tsc --noEmit && npx jest`
Expected: tsc clean; all tests pass (including the two `rowToSession` cases).

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(recording): add durable pause columns + repository writes"
```

---

### Task 2: Phase enum + pure session math (`movingElapsedMs`, `applyPause`, `applyResume`)

Introduces the `paused` phase and the pure functions that compute moving time and the pause/resume transitions. Interaction is unchanged — the recording button still holds-to-stop via the existing path; only the (still unreachable) `paused` phase is wired for rendering-nothing.

**Files:**
- Create: `src/recording/session.ts`
- Test: `src/recording/__tests__/session.test.ts` (new)
- Modify: `src/recording/recordingStore.ts:4-12` (`RecordingPhase`, `recordingPhase`)
- Modify: `src/recording/__tests__/recordingStore.test.ts` (phase cases)
- Modify: `src/map/RecordButton.tsx:88` (compile-fix: `'saving'` → `'paused'`)

**Interfaces:**
- Consumes: `RecordingSession` with `pausedAt`/`pausedMs` (Task 1).
- Produces:
  - `movingElapsedMs(session: RecordingSession, now: number): number`
  - `applyPause(session: RecordingSession, now: number): RecordingSession`
  - `applyResume(session: RecordingSession, now: number): RecordingSession`
  - `RecordingPhase = 'idle' | 'recording' | 'paused'`; `recordingPhase(session)` returns `'paused'` when `pausedAt != null`.

- [ ] **Step 1: Write the failing tests for the session math**

Create `src/recording/__tests__/session.test.ts`:

```ts
import { applyPause, applyResume, movingElapsedMs } from '../session'
import { RecordingSession } from '../../data/activities/types'

const base: RecordingSession = { id: 1, startedAt: 1000, endedAt: null, linkedTrailId: null, pausedAt: null, pausedMs: 0 }

describe('movingElapsedMs', () => {
  it('recording: elapsed since start minus accumulated pause', () => {
    expect(movingElapsedMs({ ...base, pausedMs: 2000 }, 11000)).toBe(8000)
  })
  it('paused: frozen at pausedAt minus accumulated pause', () => {
    expect(movingElapsedMs({ ...base, pausedAt: 9000, pausedMs: 2000 }, 999999)).toBe(6000)
  })
  it('clamps negatives to 0', () => {
    expect(movingElapsedMs({ ...base, pausedMs: 999999 }, 1500)).toBe(0)
  })
})

describe('applyPause', () => {
  it('stamps pausedAt with now', () => {
    expect(applyPause(base, 5000)).toEqual({ ...base, pausedAt: 5000 })
  })
})

describe('applyResume', () => {
  it('accumulates the just-ended pause into pausedMs and clears pausedAt', () => {
    expect(applyResume({ ...base, pausedAt: 5000, pausedMs: 1000 }, 8000)).toEqual({
      ...base,
      pausedAt: null,
      pausedMs: 4000,
    })
  })
  it('accumulates across multiple cycles', () => {
    const afterFirst = applyResume({ ...base, pausedAt: 3000 }, 4000) // +1000
    const paused2 = applyPause(afterFirst, 9000)
    expect(applyResume(paused2, 11000)).toEqual({ ...base, pausedAt: null, pausedMs: 3000 }) // 1000 + 2000
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/recording/__tests__/session.test.ts`
Expected: FAIL — module `../session` does not exist.

- [ ] **Step 3: Implement `src/recording/session.ts`**

```ts
import { RecordingSession } from '../data/activities/types'

export function movingElapsedMs(session: RecordingSession, now: number): number {
  const end = session.pausedAt ?? session.endedAt ?? now
  return Math.max(0, end - session.startedAt - session.pausedMs)
}

export function applyPause(session: RecordingSession, now: number): RecordingSession {
  return { ...session, pausedAt: now }
}

export function applyResume(session: RecordingSession, now: number): RecordingSession {
  return {
    ...session,
    pausedAt: null,
    pausedMs: session.pausedMs + (now - (session.pausedAt ?? now)),
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/recording/__tests__/session.test.ts`
Expected: PASS.

- [ ] **Step 5: Update the phase enum + derivation**

In `src/recording/recordingStore.ts`, replace lines 4-12:

```ts
export type RecordingPhase = 'idle' | 'recording' | 'paused'

// Phase is derived from the durable session — the single source of truth — so the UI can never
// disagree with what is persisted: no session is idle, a session with a pausedAt is paused, an
// otherwise-open session is recording.
export function recordingPhase(session: RecordingSession | null): RecordingPhase {
  if (!session) return 'idle'
  return session.pausedAt != null ? 'paused' : 'recording'
}
```

- [ ] **Step 6: Update the phase tests**

In `src/recording/__tests__/recordingStore.test.ts`: replace the `stoppedSession` literal with a paused one and update the phase cases + the `setSession` case:

```ts
const recordingSession: RecordingSession = { id: 7, startedAt: 1000, endedAt: null, linkedTrailId: null, pausedAt: null, pausedMs: 0 }
const pausedSession: RecordingSession = { id: 7, startedAt: 1000, endedAt: null, linkedTrailId: 3, pausedAt: 4000, pausedMs: 0 }
```

```ts
describe('recordingPhase', () => {
  it('no session → idle', () => {
    expect(recordingPhase(null)).toBe('idle')
  })
  it('open session (pausedAt null) → recording', () => {
    expect(recordingPhase(recordingSession)).toBe('recording')
  })
  it('session with pausedAt → paused', () => {
    expect(recordingPhase(pausedSession)).toBe('paused')
  })
})
```

In the `recordingStore` describe block, update the `setSession` test to use the paused session:

```ts
  it('setSession replaces the session without touching geometry (phase derives to paused)', () => {
    useRecordingStore.getState().hydrate(recordingSession, [p(1)])
    useRecordingStore.getState().setSession(pausedSession)
    expect(recordingPhase(useRecordingStore.getState().session)).toBe('paused')
    expect(useRecordingStore.getState().liveGeometry.points).toHaveLength(1)
  })
```

- [ ] **Step 7: Compile-fix `RecordButton`**

In `src/map/RecordButton.tsx:88`, change the early return so it hides the button in the paused phase (paused controls arrive in Task 4):

```ts
  if (phase === 'paused') return null
```

- [ ] **Step 8: Run tsc + jest to verify green**

Run: `npx tsc --noEmit && npx jest`
Expected: tsc clean; all tests pass.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(recording): paused phase + pure moving-time/pause/resume helpers"
```

---

### Task 3: Resume action + controller pause/resume/stopToSave + location-task guard

Adds the `paused` resume action and the controller entry points. `stopRecording` and the `'save'` action are intentionally kept alive until Task 7 (ordered checks keep them safe).

**Files:**
- Modify: `src/recording/resume.ts` (add `'paused'`)
- Modify: `src/recording/__tests__/resume.test.ts` (add paused case)
- Modify: `src/recording/recordingController.ts` (add `pauseRecording`, `resumeRecording`, `stopToSave`; handle `'paused'` in `resumeIfActive`)
- Modify: `src/recording/locationTask.ts:14` (guard paused)

**Interfaces:**
- Consumes: `applyPause`, `applyResume` (Task 2); `markPaused`, `markResumed`, `markLinkedTrail` (Task 1).
- Produces:
  - `ResumeAction = 'none' | 'resume' | 'paused' | 'save'`
  - `pauseRecording(): Promise<void>`
  - `resumeRecording(): Promise<void>`
  - `stopToSave(linkedTrailId: number | null): Promise<void>`

- [ ] **Step 1: Update the resume-action test**

Replace `src/recording/__tests__/resume.test.ts` with:

```ts
import { resumeActionFor } from '../resume'

const session = { id: 1, startedAt: 0, endedAt: null as number | null, linkedTrailId: null as number | null, pausedAt: null as number | null, pausedMs: 0 }

describe('resumeActionFor', () => {
  it('no session → none', () => {
    expect(resumeActionFor(null)).toBe('none')
  })
  it('open session → resume', () => {
    expect(resumeActionFor(session)).toBe('resume')
  })
  it('paused session → paused', () => {
    expect(resumeActionFor({ ...session, pausedAt: 500 })).toBe('paused')
  })
  it('stopped session (endedAt set) → save', () => {
    expect(resumeActionFor({ ...session, endedAt: 10 })).toBe('save')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest src/recording/__tests__/resume.test.ts`
Expected: FAIL — a paused session currently returns `'resume'` (or the `'paused'` case is unhandled).

- [ ] **Step 3: Update `resumeActionFor` with ordered checks**

Replace `src/recording/resume.ts` with:

```ts
import { RecordingSession } from '../data/activities/types'

export type ResumeAction = 'none' | 'resume' | 'paused' | 'save'

export function resumeActionFor(session: RecordingSession | null): ResumeAction {
  if (!session) return 'none'
  if (session.pausedAt != null) return 'paused'
  return session.endedAt == null ? 'resume' : 'save'
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx jest src/recording/__tests__/resume.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the controller entry points**

In `src/recording/recordingController.ts`, add imports at the top:

```ts
import { applyPause, applyResume } from './session'
```

Add these functions (place `pauseRecording`/`resumeRecording`/`stopToSave` after `stopRecording`):

```ts
export async function pauseRecording(): Promise<void> {
  const session = await activitiesRepository.getActiveSession()
  if (!session || session.pausedAt != null || session.endedAt != null) return
  if (await Location.hasStartedLocationUpdatesAsync(RECORDING_TASK)) {
    await Location.stopLocationUpdatesAsync(RECORDING_TASK)
  }
  const now = Date.now()
  await activitiesRepository.markPaused(session.id, now)
  useRecordingStore.getState().setSession(applyPause(session, now))
}

export async function resumeRecording(): Promise<void> {
  const session = await activitiesRepository.getActiveSession()
  if (!session || session.pausedAt == null) return
  const next = applyResume(session, Date.now())
  await activitiesRepository.markResumed(session.id, next.pausedMs)
  useRecordingStore.getState().setSession(next)
  if (!(await Location.hasStartedLocationUpdatesAsync(RECORDING_TASK))) {
    await Location.startLocationUpdatesAsync(RECORDING_TASK, RECORDING_OPTIONS)
  }
}

export async function stopToSave(linkedTrailId: number | null): Promise<void> {
  const session = await activitiesRepository.getActiveSession()
  if (!session) return
  await activitiesRepository.markLinkedTrail(session.id, linkedTrailId)
  useRecordingStore.getState().setSession({ ...session, linkedTrailId })
}
```

- [ ] **Step 6: Handle the `'paused'` action in `resumeIfActive`**

In `src/recording/recordingController.ts`, in `resumeIfActive`, add a branch so a paused session is hydrated without starting GPS. After the existing `if (action === 'resume' && session)` block and before the `else if (action === 'save' && session)` block, insert:

```ts
  } else if (action === 'paused' && session) {
    const points = await activitiesRepository.getSessionPoints(session.id)
    useRecordingStore.getState().hydrate(session, points)
```

(So the chain reads `if (resume) { … } else if (paused) { … } else if (save) { … }`.)

- [ ] **Step 7: Guard the location task against paused sessions**

In `src/recording/locationTask.ts`, change the guard line:

```ts
  if (!session || session.endedAt != null || session.pausedAt != null) return
```

- [ ] **Step 8: Run tsc + jest to verify green**

Run: `npx tsc --noEmit && npx jest`
Expected: tsc clean; all tests pass.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(recording): pause/resume/stopToSave controller + paused resume action"
```

---

### Task 4: Paused controls UI — hold-to-pause button, floating Resume/Stop, Paused chip

Switches the recording control to **hold-to-pause**, adds the two floating paused buttons, the loud top "Paused" chip, and wires them in `MapScreen`. This is the working paused-UX deliverable. **Device-verified** (no unit tests for these native/gesture components).

**Files:**
- Create: `src/assets/icons/pause.tsx`
- Create: `src/map/PausedControls.tsx`
- Modify: `src/map/RecordButton.tsx` (hold-to-pause; drop the stop path)
- Modify: `src/map/MapModeChip.tsx` (make `onExit`/`exitAccessibilityLabel` optional)
- Modify: `src/map/MapScreen.tsx` (compute `phase`; render `PausedControls` + Paused chip)

**Interfaces:**
- Consumes: `pauseRecording`, `resumeRecording`, `stopToSave` (Task 3); `recordingPhase` (Task 2); `useMapStore` selection.
- Produces: `PausedControls({ animatedBottom }: { animatedBottom?: SharedValue<number> })`.

- [ ] **Step 1: Add the pause icon**

Create `src/assets/icons/pause.tsx`:

```tsx
import React from 'react'
import Svg, { Rect } from 'react-native-svg'

export const PauseIcon = ({ size = 20, color = '#000' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Rect x="6" y="5" width="4" height="14" rx="1.5" fill={color} />
    <Rect x="14" y="5" width="4" height="14" rx="1.5" fill={color} />
  </Svg>
)
```

- [ ] **Step 2: Convert `RecordButton` to hold-to-pause**

In `src/map/RecordButton.tsx`:
- Replace the import `import { startRecording, stopRecording } from '../recording/recordingController'` with `import { startRecording, pauseRecording } from '../recording/recordingController'`.
- Remove the `useMapStore` import and the `import { StopIcon } from '../assets/icons/stop'`; add `import { PauseIcon } from '../assets/icons/pause'`.
- Delete the `doStop` callback entirely.
- Rename the gesture callback to pause and point `onStart` at pausing:

```ts
  const doPause = useCallback(async () => {
    try {
      await pauseRecording()
    } catch {
      Alert.alert('Could not pause recording', 'Something went wrong. Please try again.')
    }
  }, [])

  const hold = useMemo(
    () =>
      Gesture.LongPress()
        .minDuration(MapTokens.holdToStopMs)
        .onBegin(() => {
          progress.value = withTiming(1, { duration: MapTokens.holdToStopMs })
        })
        .onStart(() => {
          runOnJS(doPause)()
        })
        .onFinalize(() => {
          progress.value = withTiming(0, { duration: 150 })
        }),
    [doPause, progress],
  )
```

- In the recording branch JSX, change the accessibility label to `"Pause recording (press and hold)"` and swap `<StopIcon … />` for `<PauseIcon size={MapTokens.controlIconSize} color={c.recordingLine} />`.
- Keep `if (phase === 'paused') return null` (from Task 2) and the `phase === 'recording' ? … : <Play…>` structure.

- [ ] **Step 3: Create `PausedControls`**

Create `src/map/PausedControls.tsx`. It mirrors `RecordButton`'s anchor/animatedBottom pattern but renders two tap buttons in a row:

```tsx
import { useCallback } from 'react'
import { Alert, Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated'
import { useRouter } from 'expo-router'
import { useTheme } from '../theme/useTheme'
import { MapTokens } from '../theme/tokens'
import { resumeRecording, stopToSave } from '../recording/recordingController'
import { useMapStore } from '../store/mapStore'
import { PlayIcon } from '../assets/icons/play'
import { StopIcon } from '../assets/icons/stop'

const SIZE = MapTokens.controlSize

export function PausedControls({ animatedBottom }: { animatedBottom?: SharedValue<number> }) {
  const c = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const onResume = useCallback(async () => {
    try {
      await resumeRecording()
    } catch {
      Alert.alert('Could not resume recording', 'Something went wrong. Please try again.')
    }
  }, [])

  const onStop = useCallback(async () => {
    try {
      const sel = useMapStore.getState().selection
      const linkedTrailId = sel?.kind === 'trail' ? sel.id : null
      await stopToSave(linkedTrailId)
      router.push('/activity/save')
    } catch {
      Alert.alert('Could not stop recording', 'Something went wrong. Please try again.')
    }
  }, [router])

  const anchorStyle = useAnimatedStyle(() => ({
    bottom: animatedBottom ? animatedBottom.value : insets.bottom + MapTokens.overlayPadding,
  }))

  return (
    <Animated.View style={[styles.anchor, { left: MapTokens.overlayPadding }, anchorStyle]}>
      <Pressable
        accessibilityLabel="Resume recording"
        onPress={onResume}
        style={[styles.btn, { backgroundColor: c.controlSurface }]}
      >
        <PlayIcon size={MapTokens.controlIconSize} color={c.recordingLine} />
      </Pressable>
      <Pressable
        accessibilityLabel="Stop and save recording"
        onPress={onStop}
        style={[styles.btn, { backgroundColor: c.controlSurface }]}
      >
        <StopIcon size={MapTokens.controlIconSize} color={c.recordingLine} />
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', flexDirection: 'row', gap: 12 },
  btn: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
})
```

- [ ] **Step 4: Make `MapModeChip`'s exit affordance optional**

In `src/map/MapModeChip.tsx`, change the prop types so `onExit`/`exitAccessibilityLabel` are optional and only render the close button when `onExit` is provided:

```tsx
export function MapModeChip({
  label,
  icon,
  color,
  onExit,
  exitAccessibilityLabel,
}: {
  label: string
  icon: keyof typeof Ionicons.glyphMap
  color: string
  onExit?: () => void
  exitAccessibilityLabel?: string
}) {
```

and in the JSX, wrap the close `Pressable`:

```tsx
        {onExit && (
          <Pressable accessibilityLabel={exitAccessibilityLabel} onPress={onExit} hitSlop={8}>
            <Ionicons name="close" size={18} color="#FFFFFF" />
          </Pressable>
        )}
```

- [ ] **Step 5: Wire `MapScreen`**

In `src/map/MapScreen.tsx`:
- Import the new components and the phase helper:

```ts
import { PausedControls } from './PausedControls'
```

- Replace the `recording` selector with a `phase` value and derive `recording` from it:

```ts
  const phase = useRecordingStore((s) => recordingPhase(s.session))
  const recording = phase !== 'idle'
```

- In the render, gate the record button to the non-paused phases and add `PausedControls` for paused. Replace the existing `{mode !== 'activity' && (<RecordButton … />)}` with:

```tsx
        {mode !== 'activity' && phase !== 'paused' && (
          <RecordButton animatedBottom={mode === 'trail' || mode === 'recording' ? controlsAnimatedBottom : undefined} />
        )}
        {phase === 'paused' && (
          <PausedControls animatedBottom={mode === 'recording' ? controlsAnimatedBottom : undefined} />
        )}
```

- Add the loud Paused chip inside the recording branch. Replace the `{mode === 'recording' && (<RecordingInfoSheet … />)}` block with:

```tsx
        {mode === 'recording' && (
          <>
            {phase === 'paused' && (
              <MapModeChip icon="pause" color={c.recordingLine} label="Paused" />
            )}
            <RecordingInfoSheet
              followedTrailName={trail?.name ?? null}
              onRemoveTrail={clearSelection}
              animatedPosition={sheetTop}
            />
          </>
        )}
```

(`MapModeChip` is already imported in `MapScreen`.)

- [ ] **Step 6: Verify tsc + jest, then device-check**

Run: `npx tsc --noEmit && npx jest`
Expected: tsc clean; all tests pass (no unit tests changed here).

Device verification (build required — `npx expo run:android`): while recording, the bottom-left button shows a pause glyph and **holding** it fills the ring and enters paused; in paused, two buttons (Resume ▶, Stop ■) appear bottom-left and a red **"⏸ Paused"** chip appears at top; Resume returns to the recording button; Stop opens the save form.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(map): hold-to-pause button, floating Resume/Stop, Paused chip"
```

---

### Task 5: Frozen paused stats sheet (moving time)

Makes `RecordingInfoSheet` reflect the paused phase: header label, frozen moving-time duration, and pace/speed from moving time. **Device-verified** (presentational; the math is already unit-tested in Task 2).

**Files:**
- Modify: `src/recording/RecordingInfoSheet.tsx`

**Interfaces:**
- Consumes: `movingElapsedMs` (Task 2), `recordingPhase` (Task 2).

- [ ] **Step 1: Use `movingElapsedMs` and branch the header on phase**

In `src/recording/RecordingInfoSheet.tsx`:
- Add imports:

```ts
import { movingElapsedMs } from './session'
import { recordingPhase } from './recordingStore'
```

- Derive the phase and use it. Replace the `durationSeconds` computation (line 34) with the moving-time helper, and gate the 1-second ticker so it only runs while actually recording:

```ts
  const phase = recordingPhase(session)

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (phase !== 'recording') return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [phase])

  const durationSeconds = session ? movingElapsedMs(session, now) / 1000 : 0
```

- Replace the header recording text so it reflects the paused phase:

```tsx
        <Text style={[styles.recording, { color: c.recordingLine }]}>
          {phase === 'paused' ? '⏸ Paused' : '● Recording'}
        </Text>
```

(`metrics` and the `paceSpeedTile` computation are unchanged — pace/speed already take `durationSeconds`, which is now moving time.)

- [ ] **Step 2: Verify tsc + jest, then device-check**

Run: `npx tsc --noEmit && npx jest`
Expected: tsc clean; all tests pass.

Device verification: while paused, the sheet header reads **"⏸ Paused"**, the Duration stops advancing, and after Resume the Duration continues from where it froze (the break is not added). Pace/Speed reflect moving time.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(recording): frozen paused stats sheet on moving time"
```

---

### Task 6: Save flow on moving time + end-at-pause

Makes the saved activity's duration moving time and its end time the pause moment; the followed trail comes from the session (`linkedTrailId`, written at Stop in Task 3).

**Files:**
- Modify: `src/data/activities/mapping.ts` (`activityMetricsFromPoints`, `buildNewActivityInput`)
- Modify: `src/data/activities/__tests__/mapping.test.ts`
- Modify: `app/activity/save.tsx:52-53` (preview metrics)

**Interfaces:**
- Consumes: `RecordingSession.pausedAt`/`pausedMs` (Task 1).
- Produces: `activityMetricsFromPoints(points, startedAt, endedAt, pausedMs)` — duration is moving time.

- [ ] **Step 1: Update the mapping tests**

The test file already defines a shared `pts` fixture at the top (three points at `t` = 1000, 4000, 7000, `ele` 100→110→105) and an inline `session`/`form` in the `buildNewActivityInput` block. Make these exact edits:

**(a)** Replace the whole `describe('activityMetricsFromPoints', …)` block (lines 37-54) with a 4-arg version that adds a moving-time case:

```ts
describe('activityMetricsFromPoints', () => {
  it('computes distance, moving duration (wall minus paused), elevation', () => {
    const m = activityMetricsFromPoints(pts, 1000, 7000, 2000)
    expect(m.distanceMeters).toBeGreaterThan(0)
    expect(m.durationSeconds).toBe(4)
    expect(m.elevationGainMeters).toBe(10)
    expect(m.elevationLossMeters).toBe(5)
  })
  it('duration with no pause equals wall time', () => {
    expect(activityMetricsFromPoints(pts, 1000, 7000, 0).durationSeconds).toBe(6)
  })
  it('returns null elevation when no point has ele', () => {
    const flat: TrackPoint[] = [{ lat: 0, lng: 0, ele: null, t: 0 }, { lat: 0, lng: 0.001, ele: null, t: 2000 }]
    const m = activityMetricsFromPoints(flat, 0, 2000, 0)
    expect(m.elevationGainMeters).toBeNull()
    expect(m.elevationLossMeters).toBeNull()
  })
  it('never returns a negative duration', () => {
    expect(activityMetricsFromPoints(pts, 7000, 1000, 0).durationSeconds).toBe(0)
  })
})
```

**(b)** In the `describe('buildNewActivityInput', …)` block, change the `session` literal (line 57) to a paused session and update the two tests:

```ts
  const session = { id: 9, startedAt: 1000, endedAt: null, linkedTrailId: 42, pausedAt: 7000, pausedMs: 2000 }
  const form = { name: 'Morning walk', effort: 'moderate' as const, comments: 'nice' }
  it('assembles the input; endedAt is the pause moment, duration is moving time', () => {
    const input = buildNewActivityInput(session, pts, form)
    expect(input).toMatchObject({
      name: 'Morning walk', effort: 'moderate', comments: 'nice',
      linkedTrailId: 42, startedAt: 1000, endedAt: 7000,
      geometry: { points: pts },
    })
    expect(input.metrics.durationSeconds).toBe(4) // (7000 - 1000 - 2000) / 1000
  })
  it('falls back to the last point time when not paused', () => {
    const input = buildNewActivityInput({ ...session, pausedAt: null }, pts, form)
    expect(input.endedAt).toBe(7000)
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/data/activities/__tests__/mapping.test.ts`
Expected: FAIL — `activityMetricsFromPoints` has the old 3-arg signature and `buildNewActivityInput` derives `endedAt` from `session.endedAt`/last point, not `pausedAt`.

- [ ] **Step 3: Implement the moving-time mapping**

In `src/data/activities/mapping.ts`, update `activityMetricsFromPoints`:

```ts
export function activityMetricsFromPoints(
  points: TrackPoint[],
  startedAt: number,
  endedAt: number,
  pausedMs: number,
): ActivityMetrics {
  const m = computeMetrics(points)
  return {
    distanceMeters: m.distanceMeters,
    durationSeconds: Math.max(0, Math.round((endedAt - startedAt - pausedMs) / 1000)),
    elevationGainMeters: m.elevationGainMeters,
    elevationLossMeters: m.elevationLossMeters,
  }
}
```

and `buildNewActivityInput`:

```ts
export function buildNewActivityInput(
  session: RecordingSession,
  points: TrackPoint[],
  form: ActivityFormFields,
): NewActivityInput {
  const endedAt = session.pausedAt ?? points[points.length - 1]?.t ?? session.startedAt
  return {
    name: form.name,
    effort: form.effort,
    comments: form.comments,
    linkedTrailId: session.linkedTrailId,
    geometry: { points },
    metrics: activityMetricsFromPoints(points, session.startedAt, endedAt, session.pausedMs),
    startedAt: session.startedAt,
    endedAt,
  }
}
```

- [ ] **Step 4: Update the save screen preview metrics**

In `app/activity/save.tsx`, replace lines 52-53:

```ts
  const endedAt = session.pausedAt ?? points[points.length - 1]?.t ?? session.startedAt
  const metrics = activityMetricsFromPoints(points, session.startedAt, endedAt, session.pausedMs)
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest src/data/activities/__tests__/mapping.test.ts && npx tsc --noEmit`
Expected: PASS; tsc clean.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(recording): save activity on moving time, end at pause moment"
```

---

### Task 7: Remove the dead stop path

Deletes the now-unused legacy: `stopRecording`, `markStopped`, the `'save'` resume action + its navigation, and the stale `'saving'` comment. Pure deletion; ends green.

**Files:**
- Modify: `src/recording/recordingController.ts` (remove `stopRecording`; drop the `'save'` branch + stale comment in `resumeIfActive`)
- Modify: `src/recording/resume.ts` (drop `'save'`)
- Modify: `src/recording/__tests__/resume.test.ts` (drop the `save` case)
- Modify: `src/recording/useResumeRecording.ts` (drop the `action === 'save'` navigation)
- Modify: `src/data/activities/repository.ts` (remove `markStopped`)
- Modify: `src/data/db/activitiesRepository.ts` (remove `markStopped`)

- [ ] **Step 1: Drop `'save'` from the resume action + its test case**

In `src/recording/resume.ts`:

```ts
export type ResumeAction = 'none' | 'resume' | 'paused'

export function resumeActionFor(session: RecordingSession | null): ResumeAction {
  if (!session) return 'none'
  if (session.pausedAt != null) return 'paused'
  return 'resume'
}
```

In `src/recording/__tests__/resume.test.ts`, delete the `'stopped session (endedAt set) → save'` test case.

- [ ] **Step 2: Remove `stopRecording` and the `'save'` handling in the controller**

In `src/recording/recordingController.ts`:
- Delete the entire `export async function stopRecording(...) { … }` function.
- In `resumeIfActive`, delete the `else if (action === 'save' && session) { … }` branch and its preceding comment (the stale `// Reflect the stopped session so phase derives to 'saving' …` note).

- [ ] **Step 3: Remove the `'save'` navigation from the resume hook**

In `src/recording/useResumeRecording.ts`, delete the `if (action === 'save') router.push('/activity/save')` line inside the `.then(...)`. The `.then` callback body becomes a no-op comment (or drop the destructured `action`):

```ts
      .then(() => {
        // Resume/paused sessions are hydrated by resumeIfActive; the map renders their controls.
        // A killed-while-paused session lands on the paused map, from which Stop reaches the save form.
      })
```

- [ ] **Step 4: Remove `markStopped` from the repository**

In `src/data/activities/repository.ts`, delete the `markStopped(...)` line from the interface.
In `src/data/db/activitiesRepository.ts`, delete the `async markStopped(...) { … }` implementation.

- [ ] **Step 5: Run tsc + jest to verify green**

Run: `npx tsc --noEmit && npx jest`
Expected: tsc clean (no remaining references to `stopRecording`/`markStopped`/`'save'`); all tests pass.

Confirm nothing references the removed symbols:

```bash
grep -rn "stopRecording\|markStopped\|'save'\|\"save\"" src app --include=*.ts --include=*.tsx | grep -v saveActivity
```

Expected: no matches (other than `saveActivity`, which is unrelated).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(recording): remove dead stop path (stopRecording/markStopped/'save')"
```

---

## Post-implementation: full device verification

After Task 7, run the spec's device-verification checklist on a debug build (`npx expo run:android`):

1. Hold-to-pause ring pauses; Resume/Stop buttons + top "Paused" chip appear.
2. GPS stops on pause (OS recording notification disappears) and restarts on resume (notification returns; track continues).
3. Moving time excludes a real break (pause a few minutes, resume; Duration does not jump by the break length; Pace reflects moving time).
4. Multiple pause/resume cycles accumulate correctly.
5. Stop → save form → **back** returns to the live paused map with Resume/Stop available (bug #18).
6. App killed while paused → relaunch lands on the paused map (not an auto-opened save form); Resume and Stop both work.
7. Following-trail pill still changes/removes the trail while paused; the trail followed at Stop is the one linked to the saved activity.
