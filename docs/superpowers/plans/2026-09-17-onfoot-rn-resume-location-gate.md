# Resume Location Gate & Segment-Bound Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resuming a recording is refused while location is unavailable, exactly like starting, and a segment never accepts a location fix taken before it began — so pausing, moving with location off and resuming no longer draws a line from the pause point.

**Architecture:** Each recording session durably records when its current segment began (`segmentStartedAt`), set on start, resume and relaunch; the background fix handler drops fixes older than that through a pure `fixesInSegment`. The controller's pre-turn permission/location gate is extracted into `ensureCaptureReady`, shared by `startRecording` and a `resumeRecording` that now returns a result; one pure `captureRefusalAlert` gives both buttons the same alert copy.

**Tech Stack:** React Native 0.86 / Expo SDK 57, TypeScript, zustand, drizzle-orm + expo-sqlite (drizzle-kit migrations), Jest 29 via jest-expo.

**Spec:** `docs/superpowers/specs/2026-09-17-onfoot-rn-resume-location-gate-design.md`

## Global Constraints

- New session field: `segmentStartedAt: number`; column `segment_started_at`; migration `0006` backfills existing rows from `started_at`.
- `segmentStartedAt` is set by `startSession(startedAt)` (to `startedAt`), `applyResume(session, now)` (to `now`) and `applyRelaunch(session, now)` (to `now`); `markResumed` persists it alongside `pausedMs` and `currentSegment`.
- A fix belongs to a segment when `t >= segmentStartedAt`; a delivery left empty appends nothing.
- `type CaptureReadiness = 'ready' | 'permission-denied' | 'location-off'`; `ensureCaptureReady` runs **outside the chain** — a dialog that never answers must not hold pause, resume or discard behind it.
- `ResumeResult = 'resumed' | 'permission-denied' | 'location-off'`; a refused resume leaves the session paused.
- Alert copy, verbatim:
  - permission denied (start or resume): title `Location permission needed`, message `To record your activity while the app is in the background, allow location access "All the time".`
  - location off, start: title `Location is off`, message `Turn on location to start recording.`
  - location off, resume: title `Location is off`, message `Turn on location to resume recording.`
- `AGENTS.md` governs: comments describe the current state of the code, never the change; no new `any`, `@ts-ignore`, `eslint-disable` or `DUPLICATION_EXEMPT`; pure logic is TDD'd; rendering is device-verified (no component tests).
- `npm run verify` must exit 0 at the end of every task.
- Stage files by name; never `git add -A` / `git add .`; never stage `.claude/`, `.serena/`, `run-app.sh` or `.superpowers/`. Never amend, force, rebase or push.
- Commit messages follow the repo: `type(scope): subject`, then a blank line and `Claude-Session: https://claude.ai/code/session_01T6bQLYpvuUQoNU2hCv8zbp`.

---

### Task 1: The session records when its current segment began

**Files:**
- Modify: `src/data/activities/types.ts` (`RecordingSession`)
- Modify: `src/data/activities/mapping.ts` (`RecordingSessionRow`, `rowToSession`)
- Modify: `src/data/db/schema.ts` (`recordingSessions`)
- Create: `src/data/db/migrations/0006_*.sql` (generated), plus the generated snapshot, journal and `migrations.js` updates
- Modify: `src/data/activities/repository.ts` (`markResumed`)
- Modify: `src/data/db/activitiesRepository.ts` (`startSession`, `markResumed`)
- Modify: `src/recording/session.ts` (`applyResume`, `applyRelaunch`)
- Modify: `src/recording/recordingController.ts` (`startRecording`, `resumeRecording`, `resumeAfterProcessDeath`)
- Test: `src/recording/__tests__/session.test.ts`, `src/data/activities/__tests__/mapping.test.ts`, `src/recording/__tests__/recordingController.test.ts`, `src/recording/__tests__/recordingStore.test.ts`, `src/recording/__tests__/resume.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `RecordingSession.segmentStartedAt: number`
  - `ActivitiesRepository.markResumed(sessionId: number, pausedMs: number, currentSegment: number, segmentStartedAt: number): Promise<void>`
  - `applyResume(session: RecordingSession, now: number): RecordingSession` — sets `segmentStartedAt: now`
  - `applyRelaunch(session: RecordingSession, now: number): RecordingSession` — sets `segmentStartedAt: now`

- [ ] **Step 1: Write the failing tests and update the fixtures**

In `src/recording/__tests__/session.test.ts`, replace the `base` fixture and the `applyResume` and `applyRelaunch` blocks:

```ts
const base: RecordingSession = {
  id: 1, startedAt: 1000, linkedTrailId: null, pausedAt: null, pausedMs: 0, currentSegment: 0, segmentStartedAt: 1000,
}
```

```ts
describe('applyResume', () => {
  it('accumulates the just-ended pause into pausedMs, clears pausedAt, opens the next segment from now', () => {
    expect(applyResume({ ...base, pausedAt: 5000, pausedMs: 1000 }, 8000)).toEqual({
      ...base,
      pausedAt: null,
      pausedMs: 4000,
      currentSegment: 1,
      segmentStartedAt: 8000,
    })
  })
  it('increments the segment on each resume across cycles', () => {
    const afterFirst = applyResume({ ...base, pausedAt: 3000 }, 4000) // seg 1
    const paused2 = applyPause(afterFirst, 9000)
    expect(applyResume(paused2, 11000)).toEqual({
      ...base, pausedAt: null, pausedMs: 3000, currentSegment: 2, segmentStartedAt: 11000,
    })
  })
})

describe('applyRelaunch', () => {
  it('opens the next segment from now and leaves the timing untouched', () => {
    const running = { ...base, pausedMs: 1500, currentSegment: 2 }
    expect(applyRelaunch(running, 20000)).toEqual({ ...running, currentSegment: 3, segmentStartedAt: 20000 })
  })
})
```

In `src/data/activities/__tests__/mapping.test.ts`, replace the `rowToSession` block and the `session` constant of `buildNewActivityInput`:

```ts
describe('rowToSession', () => {
  it('maps a recording session row including pause + segment fields', () => {
    expect(
      rowToSession({ id: 3, startedAt: 10, linkedTrailId: null, pausedAt: null, pausedMs: 0, currentSegment: 0, segmentStartedAt: 10 }),
    ).toEqual({ id: 3, startedAt: 10, linkedTrailId: null, pausedAt: null, pausedMs: 0, currentSegment: 0, segmentStartedAt: 10 })
  })
  it('maps a paused session on a later segment', () => {
    expect(
      rowToSession({ id: 3, startedAt: 10, linkedTrailId: 2, pausedAt: 500, pausedMs: 120, currentSegment: 2, segmentStartedAt: 300 }),
    ).toEqual({ id: 3, startedAt: 10, linkedTrailId: 2, pausedAt: 500, pausedMs: 120, currentSegment: 2, segmentStartedAt: 300 })
  })
})
```

```ts
  const session = { id: 9, startedAt: 1000, linkedTrailId: 42, pausedAt: 7000, pausedMs: 2000, currentSegment: 0, segmentStartedAt: 1000 }
```

In `src/recording/__tests__/recordingStore.test.ts`, add `segmentStartedAt: 1000,` to both `recordingSession` and `pausedSession` fixtures.

In `src/recording/__tests__/resume.test.ts`, the fixture becomes:

```ts
const session = { id: 1, startedAt: 0, linkedTrailId: null as number | null, pausedAt: null as number | null, pausedMs: 0, currentSegment: 0, segmentStartedAt: 0 }
```

In `src/recording/__tests__/recordingController.test.ts`:

1. The `recording` fixture becomes:

```ts
const recording: RecordingSession = {
  id: 7, startedAt: 1000, linkedTrailId: null, pausedAt: null, pausedMs: 500, currentSegment: 1, segmentStartedAt: 1000,
}
```

2. In `beforeEach`, the `startSession` and `markResumed` fakes become:

```ts
  repo.startSession.mockImplementation(async (startedAt) => {
    row = { id: 42, startedAt, linkedTrailId: null, pausedAt: null, pausedMs: 0, currentSegment: 0, segmentStartedAt: startedAt }
    calls.push('startSession')
    return 42
  })
```

```ts
  repo.markResumed.mockImplementation(async (_id, pausedMs, currentSegment, segmentStartedAt) => {
    row = row && { ...row, pausedAt: null, pausedMs, currentSegment, segmentStartedAt }
    calls.push('markResumed')
  })
```

3. Add to `describe('startRecording')`:

```ts
  it('begins the first segment when the session starts', async () => {
    await startRecording()
    const session = useRecordingStore.getState().session
    expect(session?.segmentStartedAt).toBe(session?.startedAt)
  })
```

4. In `describe('resumeRecording')`, change the assertion of `'commits the resume and starts nothing while location is off'` to:

```ts
    expect(repo.markResumed).toHaveBeenCalledWith(7, expect.any(Number), 2, expect.any(Number))
```

and add:

```ts
  it('begins the next segment at the moment of the resume', async () => {
    const clock = jest.spyOn(Date, 'now').mockReturnValue(9000)
    try {
      await resumeRecording()
    } finally {
      clock.mockRestore()
    }
    expect(repo.markResumed).toHaveBeenCalledWith(7, 5500, 2, 9000)
    expect(useRecordingStore.getState().session?.segmentStartedAt).toBe(9000)
  })
```

5. In `describe('resumeIfActive')`, in `'opens a new segment, announces the gap and restarts capture after the process died'`, replace the `markResumed` assertion with:

```ts
    expect(repo.markResumed).toHaveBeenCalledWith(7, 500, 2, reopenedAt)
    expect(useRecordingStore.getState().session?.segmentStartedAt).toBe(reopenedAt)
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/recording/__tests__/session.test.ts src/data/activities/__tests__/mapping.test.ts src/recording/__tests__/recordingController.test.ts`
Expected: FAIL — `segmentStartedAt` is missing from `applyResume`/`applyRelaunch` results and from `rowToSession`, `markResumed` is called with three arguments, and the started session has no `segmentStartedAt`.

- [ ] **Step 3: Add the field to the domain type and the row mapping**

In `src/data/activities/types.ts`, `RecordingSession` becomes:

```ts
export interface RecordingSession {
  id: number
  startedAt: number
  linkedTrailId: number | null
  pausedAt: number | null
  pausedMs: number
  currentSegment: number
  // When the current segment began; a fix taken earlier does not belong to it.
  segmentStartedAt: number
}
```

In `src/data/activities/mapping.ts`, add `segmentStartedAt: number` as the last field of `RecordingSessionRow`, and `segmentStartedAt: row.segmentStartedAt,` as the last field returned by `rowToSession`.

- [ ] **Step 4: Add the column and generate the migration**

In `src/data/db/schema.ts`, add after `currentSegment` in `recordingSessions`:

```ts
    segmentStartedAt: integer('segment_started_at').notNull().default(0),
```

Run: `npm run db:generate`
Expected: a new `src/data/db/migrations/0006_<generated-name>.sql` containing
`ALTER TABLE \`recording_sessions\` ADD \`segment_started_at\` integer DEFAULT 0 NOT NULL;`, a new `meta/0006_snapshot.json`, and updated `meta/_journal.json` and `migrations.js`.

Append the backfill to the end of the generated `.sql` file, so a session open during the upgrade keeps every fix it captured:

```sql
--> statement-breakpoint
UPDATE `recording_sessions` SET `segment_started_at` = `started_at`;
```

- [ ] **Step 5: Persist it in the repository**

In `src/data/activities/repository.ts`:

```ts
  markResumed(sessionId: number, pausedMs: number, currentSegment: number, segmentStartedAt: number): Promise<void>
```

In `src/data/db/activitiesRepository.ts`, `startSession` inserts `.values({ startedAt, segmentStartedAt: startedAt })`, and `markResumed` becomes:

```ts
  async markResumed(sessionId, pausedMs, currentSegment, segmentStartedAt) {
    await db.update(recordingSessions)
      .set({ pausedAt: null, pausedMs, currentSegment, segmentStartedAt })
      .where(eq(recordingSessions.id, sessionId))
  },
```

- [ ] **Step 6: Set it on resume and relaunch**

In `src/recording/session.ts`:

```ts
export function applyResume(session: RecordingSession, now: number): RecordingSession {
  return {
    ...session,
    pausedAt: null,
    pausedMs: session.pausedMs + (now - (session.pausedAt ?? now)),
    currentSegment: session.currentSegment + 1,
    segmentStartedAt: now,
  }
}

// After the process died while recording, capture resumes in its own segment so the saved track is
// not joined across the gap. The gap still counts as elapsed time.
export function applyRelaunch(session: RecordingSession, now: number): RecordingSession {
  return { ...session, currentSegment: session.currentSegment + 1, segmentStartedAt: now }
}
```

In `src/recording/recordingController.ts`:

- `startRecording`'s `beginSession` call:

```ts
    useRecordingStore.getState().beginSession({
      id: sessionId, startedAt, linkedTrailId: null, pausedAt: null, pausedMs: 0, currentSegment: 0, segmentStartedAt: startedAt,
    })
```

- `resumeRecording`:

```ts
    await activitiesRepository.markResumed(session.id, next.pausedMs, next.currentSegment, next.segmentStartedAt)
```

- `resumeAfterProcessDeath`:

```ts
  const relaunched = applyRelaunch(session, Date.now())
  await activitiesRepository.markResumed(relaunched.id, relaunched.pausedMs, relaunched.currentSegment, relaunched.segmentStartedAt)
```

- [ ] **Step 7: Run the tests and the gate**

Run: `npx jest src/recording src/data/activities`
Expected: PASS.

Run: `npm run verify`
Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git add src/data/activities/types.ts src/data/activities/mapping.ts src/data/activities/repository.ts \
  src/data/db/schema.ts src/data/db/activitiesRepository.ts src/data/db/migrations \
  src/recording/session.ts src/recording/recordingController.ts \
  src/recording/__tests__/session.test.ts src/data/activities/__tests__/mapping.test.ts \
  src/recording/__tests__/recordingController.test.ts src/recording/__tests__/recordingStore.test.ts \
  src/recording/__tests__/resume.test.ts
git commit -m "$(cat <<'EOF'
feat(recording): record when each segment began, on start, resume and relaunch

Claude-Session: https://claude.ai/code/session_01T6bQLYpvuUQoNU2hCv8zbp
EOF
)"
```

---

### Task 2: A segment only accepts fixes taken after it began

**Files:**
- Modify: `src/recording/session.ts` (add `fixesInSegment`)
- Modify: `src/recording/locationTask.ts`
- Test: `src/recording/__tests__/session.test.ts`
- Create test: `src/recording/__tests__/locationTask.test.ts`

**Interfaces:**
- Consumes: `RecordingSession.segmentStartedAt: number` (Task 1).
- Produces: `fixesInSegment<T extends { t: number }>(fixes: T[], segmentStartedAt: number): T[]`

- [ ] **Step 1: Write the failing tests**

In `src/recording/__tests__/session.test.ts`, change the import to include `fixesInSegment`:

```ts
import { applyPause, applyRelaunch, applyResume, fixesInSegment, movingElapsedMs } from '../session'
```

and append:

```ts
describe('fixesInSegment', () => {
  const fix = (t: number) => ({ lat: 0, lng: 0, ele: null, t })

  it('keeps a fix taken exactly when the segment began, and later ones', () => {
    expect(fixesInSegment([fix(5000), fix(5001)], 5000)).toEqual([fix(5000), fix(5001)])
  })
  it('drops a fix taken before the segment began', () => {
    expect(fixesInSegment([fix(4999), fix(6000)], 5000)).toEqual([fix(6000)])
  })
})
```

Create `src/recording/__tests__/locationTask.test.ts`:

```ts
jest.mock('../../location', () => ({ defineBackgroundFixHandler: jest.fn() }))
jest.mock('../../data/activities', () => ({
  activitiesRepository: { getActiveSession: jest.fn(), appendPoints: jest.fn() },
}))

import { defineBackgroundFixHandler } from '../../location'
import type { LocationFix } from '../../location'
import { activitiesRepository } from '../../data/activities'
import type { RecordingSession } from '../../data/activities'
import { useRecordingStore } from '../recordingStore'
import '../locationTask'

const handleFixes = jest.mocked(defineBackgroundFixHandler).mock.calls[0][0]
const repo = jest.mocked(activitiesRepository)

const session: RecordingSession = {
  id: 7, startedAt: 1000, linkedTrailId: null, pausedAt: null, pausedMs: 0, currentSegment: 2, segmentStartedAt: 5000,
}
const fix = (t: number): LocationFix => ({ lat: 45, lng: 6, ele: 1200, t })

beforeEach(() => {
  repo.getActiveSession.mockResolvedValue(session)
  repo.appendPoints.mockReset()
  useRecordingStore.setState({ session, livePoints: [] })
})

it('stores and shows only the fixes taken after the segment began', async () => {
  await handleFixes([fix(4000), fix(6000)])
  expect(repo.appendPoints).toHaveBeenCalledWith(7, 2, [fix(6000)])
  expect(useRecordingStore.getState().livePoints).toEqual([{ ...fix(6000), segment: 2 }])
})

it('appends nothing when every fix was taken before the segment began', async () => {
  await handleFixes([fix(4000)])
  expect(repo.appendPoints).not.toHaveBeenCalled()
  expect(useRecordingStore.getState().livePoints).toEqual([])
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/recording/__tests__/session.test.ts src/recording/__tests__/locationTask.test.ts`
Expected: FAIL — `fixesInSegment` is not a function; the handler appends the fix taken at 4000 and appends when every fix is stale.

- [ ] **Step 3: Implement**

Append to `src/recording/session.ts`:

```ts
// A fix taken before its segment began is not part of it: the location service can hand back a cached
// position — such as where the recording paused — as the first fix after capture restarts.
export function fixesInSegment<T extends { t: number }>(fixes: T[], segmentStartedAt: number): T[] {
  return fixes.filter((fix) => fix.t >= segmentStartedAt)
}
```

Replace `src/recording/locationTask.ts` with:

```ts
import { defineBackgroundFixHandler } from '../location'
import { activitiesRepository } from '../data/activities'
import { useRecordingStore } from './recordingStore'
import { fixesInSegment } from './session'

defineBackgroundFixHandler(async (fixes) => {
  const session = await activitiesRepository.getActiveSession()
  if (!session || session.pausedAt != null) return
  const segmentFixes = fixesInSegment(fixes, session.segmentStartedAt)
  if (segmentFixes.length === 0) return
  await activitiesRepository.appendPoints(session.id, session.currentSegment, segmentFixes)
  useRecordingStore.getState().appendLivePoints(session.currentSegment, segmentFixes)
})
```

- [ ] **Step 4: Run the tests and the gate**

Run: `npx jest src/recording/__tests__/session.test.ts src/recording/__tests__/locationTask.test.ts`
Expected: PASS.

Run: `npm run verify`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/recording/session.ts src/recording/locationTask.ts \
  src/recording/__tests__/session.test.ts src/recording/__tests__/locationTask.test.ts
git commit -m "$(cat <<'EOF'
fix(recording): drop location fixes taken before their segment began

Claude-Session: https://claude.ai/code/session_01T6bQLYpvuUQoNU2hCv8zbp
EOF
)"
```

---

### Task 3: Resume passes the same gate as start

**Files:**
- Modify: `src/recording/recordingController.ts`
- Test: `src/recording/__tests__/recordingController.test.ts`

**Interfaces:**
- Consumes: `applyResume(session, now)` and `markResumed(..., segmentStartedAt)` (Task 1).
- Produces:
  - `export type CaptureReadiness = 'ready' | 'permission-denied' | 'location-off'`
  - `export type CaptureRefusal = Exclude<CaptureReadiness, 'ready'>`
  - `export type ResumeResult = 'resumed' | CaptureRefusal`
  - `export async function resumeRecording(): Promise<ResumeResult>`
  - `StartResult` is unchanged: `'started' | 'permission-denied' | 'already-active' | 'location-off'`

- [ ] **Step 1: Write the failing tests**

In `src/recording/__tests__/recordingController.test.ts`, replace the whole `describe('resumeRecording')` block with:

```ts
describe('resumeRecording', () => {
  beforeEach(() => {
    row = paused
    useRecordingStore.setState({ session: paused })
  })

  it('commits the resume, then starts the stream', async () => {
    await expect(resumeRecording()).resolves.toBe('resumed')
    expect(calls).toEqual(['markResumed', 'start'])
    expect(useRecordingStore.getState().session?.pausedAt).toBeNull()
    expect(useRecordingStore.getState().stream).toEqual({ kind: 'live' })
  })

  it('begins the next segment at the moment of the resume', async () => {
    const clock = jest.spyOn(Date, 'now').mockReturnValue(9000)
    try {
      await resumeRecording()
    } finally {
      clock.mockRestore()
    }
    expect(repo.markResumed).toHaveBeenCalledWith(7, 5500, 2, 9000)
    expect(useRecordingStore.getState().session?.segmentStartedAt).toBe(9000)
  })

  it('stays paused when location access is refused', async () => {
    port.requestForegroundAccess.mockResolvedValue(false)
    await expect(resumeRecording()).resolves.toBe('permission-denied')
    expect(repo.markResumed).not.toHaveBeenCalled()
    expect(port.startBackgroundTracking).not.toHaveBeenCalled()
    expect(useRecordingStore.getState().session).toEqual(paused)
  })

  it('stays paused when "All the time" location access is refused', async () => {
    port.requestBackgroundAccess.mockResolvedValue(false)
    await expect(resumeRecording()).resolves.toBe('permission-denied')
    expect(repo.markResumed).not.toHaveBeenCalled()
    expect(port.startBackgroundTracking).not.toHaveBeenCalled()
  })

  it('stays paused while location is off and the prompt is declined', async () => {
    port.isLocationAvailable.mockResolvedValue(false)
    port.promptToEnableLocation.mockResolvedValue(false)
    await expect(resumeRecording()).resolves.toBe('location-off')
    expect(repo.markResumed).not.toHaveBeenCalled()
    expect(port.startBackgroundTracking).not.toHaveBeenCalled()
    expect(useRecordingStore.getState().session).toEqual(paused)
  })

  it('resumes once the user accepts the location prompt', async () => {
    port.isLocationAvailable.mockResolvedValueOnce(false)
    await expect(resumeRecording()).resolves.toBe('resumed')
    expect(repo.markResumed).toHaveBeenCalledTimes(1)
    expect(port.startBackgroundTracking).toHaveBeenCalledWith(RECORDING_OPTIONS)
  })

  it('commits the resume and starts nothing when location still reads off after the prompt was accepted', async () => {
    port.isLocationAvailable.mockResolvedValue(false)
    await expect(resumeRecording()).resolves.toBe('resumed')
    expect(repo.markResumed).toHaveBeenCalledTimes(1)
    expect(port.startBackgroundTracking).not.toHaveBeenCalled()
    expect(useRecordingStore.getState().locationAvailable).toBe(false)
  })

  it('does not hold a discard behind the location prompt', async () => {
    const prompt = deferred<boolean>()
    port.isLocationAvailable.mockResolvedValue(false)
    port.promptToEnableLocation.mockReturnValue(prompt.promise)
    const resumed = resumeRecording()
    await settle()
    await expect(discardRecording(7)).resolves.toBeUndefined()
    prompt.resolve(false)
    await expect(resumed).resolves.toBe('location-off')
  })

  it('writes the resume only once the app is active again', async () => {
    const active = deferred()
    app.whenAppActive.mockReturnValue(active.promise)
    const resumed = resumeRecording()
    await settle()
    expect(repo.markResumed).not.toHaveBeenCalled()
    active.resolve()
    await expect(resumed).resolves.toBe('resumed')
  })

  it('asks nothing when no session is paused', async () => {
    row = recording
    await expect(resumeRecording()).resolves.toBe('resumed')
    expect(port.requestForegroundAccess).not.toHaveBeenCalled()
    expect(repo.markResumed).not.toHaveBeenCalled()
  })

  it('resumes once when Resume is pressed twice before either resume queues', async () => {
    const results = await Promise.all([resumeRecording(), resumeRecording()])
    expect(results).toEqual(['resumed', 'resumed'])
    expect(repo.markResumed).toHaveBeenCalledTimes(1)
  })

  it('keeps the resume when the start is rejected, recording the fault', async () => {
    port.startBackgroundTracking.mockRejectedValue(new Error('refused'))
    await expect(resumeRecording()).resolves.toBe('resumed')
    expect(useRecordingStore.getState().session?.pausedAt).toBeNull()
    expect(useRecordingStore.getState().stream).toEqual({ kind: 'faulted', fault: 'start-failed' })
  })
})
```

The `describe('startRecording')` tests stay as they are: they must pass unchanged through the extracted gate.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/recording/__tests__/recordingController.test.ts -t resumeRecording`
Expected: FAIL — `resumeRecording` resolves `undefined`, commits while location is off or access is refused, and prompts nothing.

- [ ] **Step 3: Implement the gate and the resume result**

In `src/recording/recordingController.ts`, replace the `StartResult` type line with:

```ts
export type StartResult = 'started' | 'permission-denied' | 'already-active' | 'location-off'
export type CaptureReadiness = 'ready' | 'permission-denied' | 'location-off'
export type CaptureRefusal = Exclude<CaptureReadiness, 'ready'>
export type ResumeResult = 'resumed' | CaptureRefusal
```

Replace the comment above `startRecording` and `startRecording` itself with:

```ts
// What capturing needs before a session may record: location access and a location provider, or the
// user's acceptance of the prompt to turn one on. It runs before a turn is queued: a dialog that never
// answers must not hold pause, resume or discard behind it.
async function ensureCaptureReady(): Promise<CaptureReadiness> {
  if (!(await requestForegroundAccess())) return 'permission-denied'
  // A recording must go on capturing once the app leaves the foreground, so capturing asks for "All
  // the time" access; recovery only ever restarts a stream while the app is active, so it needs no
  // more than the foreground grant checked in ensureStreaming.
  if (!(await requestBackgroundAccess())) return 'permission-denied'
  if (!(await isLocationAvailable()) && !(await promptToEnableLocation())) return 'location-off'
  return 'ready'
}

export async function startRecording(): Promise<StartResult> {
  if (await activitiesRepository.getActiveSession()) return 'already-active'
  const readiness = await ensureCaptureReady()
  if (readiness !== 'ready') return readiness
  await ensureTrackingNotificationAccess()
  await whenAppActive()
  return exclusive<StartResult>(async () => {
    // A session found here belongs to a concurrent tap that reached the turn first: the tap that
    // lost reports the start it asked for, not a pre-existing recording.
    if (await activitiesRepository.getActiveSession()) return 'started'
    const startedAt = Date.now()
    const sessionId = await activitiesRepository.startSession(startedAt)
    useRecordingStore.getState().beginSession({
      id: sessionId, startedAt, linkedTrailId: null, pausedAt: null, pausedMs: 0, currentSegment: 0, segmentStartedAt: startedAt,
    })
    await issueStream()
    return 'started'
  })
}
```

Replace the comment above `resumeRecording` and `resumeRecording` itself with:

```ts
// Resuming needs what starting needs, so a refusal leaves the session paused. Once resumed, the session
// is visibly recording whether or not its stream starts, so a refused start is a capture fault the sheet
// shows, not a failed resume.
export async function resumeRecording(): Promise<ResumeResult> {
  const current = await activitiesRepository.getActiveSession()
  if (!current || current.pausedAt == null) return 'resumed'
  const readiness = await ensureCaptureReady()
  if (readiness !== 'ready') return readiness
  await whenAppActive()
  return exclusive<ResumeResult>(async () => {
    const session = await activitiesRepository.getActiveSession()
    // Not paused here means a concurrent resume reached the turn first.
    if (!session || session.pausedAt == null) return 'resumed'
    const next = applyResume(session, Date.now())
    await activitiesRepository.markResumed(session.id, next.pausedMs, next.currentSegment, next.segmentStartedAt)
    useRecordingStore.getState().setSession(next)
    await issueStreamIfAvailable()
    return 'resumed'
  })
}
```

- [ ] **Step 4: Run the tests and the gate**

Run: `npx jest src/recording/__tests__/recordingController.test.ts`
Expected: PASS — including every `startRecording` test, unchanged.

Run: `npm run verify`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/recording/recordingController.ts src/recording/__tests__/recordingController.test.ts
git commit -m "$(cat <<'EOF'
fix(recording): refuse to resume without location, through the gate start uses

Claude-Session: https://claude.ai/code/session_01T6bQLYpvuUQoNU2hCv8zbp
EOF
)"
```

---

### Task 4: One set of refusal alerts for Record and Resume

**Files:**
- Create: `src/recording/captureAlerts.ts`
- Create test: `src/recording/__tests__/captureAlerts.test.ts`
- Modify: `src/map/RecordButton.tsx` (`onPlay`)
- Modify: `src/map/PausedControls.tsx` (`onResume`)

**Interfaces:**
- Consumes: `CaptureRefusal`, `StartResult`, `ResumeResult`, `resumeRecording(): Promise<ResumeResult>` (Task 3).
- Produces: `captureRefusalAlert(refusal: CaptureRefusal, action: CaptureAction): { title: string; message: string }`, with `type CaptureAction = 'start' | 'resume'`.

- [ ] **Step 1: Write the failing test**

Create `src/recording/__tests__/captureAlerts.test.ts`:

```ts
import { captureRefusalAlert } from '../captureAlerts'

describe('captureRefusalAlert', () => {
  it('asks for "All the time" access whichever action was refused', () => {
    const expected = {
      title: 'Location permission needed',
      message: 'To record your activity while the app is in the background, allow location access "All the time".',
    }
    expect(captureRefusalAlert('permission-denied', 'start')).toEqual(expected)
    expect(captureRefusalAlert('permission-denied', 'resume')).toEqual(expected)
  })

  it('names the refused action when location is off', () => {
    expect(captureRefusalAlert('location-off', 'start')).toEqual({
      title: 'Location is off',
      message: 'Turn on location to start recording.',
    })
    expect(captureRefusalAlert('location-off', 'resume')).toEqual({
      title: 'Location is off',
      message: 'Turn on location to resume recording.',
    })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/recording/__tests__/captureAlerts.test.ts`
Expected: FAIL — `Cannot find module '../captureAlerts'`.

- [ ] **Step 3: Implement the mapping**

Create `src/recording/captureAlerts.ts`:

```ts
import type { CaptureRefusal } from './recordingController'

export type CaptureAction = 'start' | 'resume'

// Starting and resuming are refused for the same reasons, so they explain the refusal in the same words.
export function captureRefusalAlert(refusal: CaptureRefusal, action: CaptureAction): { title: string; message: string } {
  if (refusal === 'permission-denied') {
    return {
      title: 'Location permission needed',
      message: 'To record your activity while the app is in the background, allow location access "All the time".',
    }
  }
  return { title: 'Location is off', message: `Turn on location to ${action} recording.` }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/recording/__tests__/captureAlerts.test.ts`
Expected: PASS.

- [ ] **Step 5: Route both buttons through it**

In `src/map/RecordButton.tsx`, add `import { captureRefusalAlert } from '../recording/captureAlerts'` beside the other `../recording/` imports, and replace `onPlay` with:

```tsx
  const onPlay = useCallback(async () => {
    try {
      const result = await startRecording()
      if (result === 'already-active') {
        router.push('/activity/save')
      } else if (result !== 'started') {
        const { title, message } = captureRefusalAlert(result, 'start')
        Alert.alert(title, message)
      }
    } catch {
      Alert.alert('Could not start recording', 'Something went wrong. Please try again.')
    }
  }, [router])
```

In `src/map/PausedControls.tsx`, add `import { captureRefusalAlert } from '../recording/captureAlerts'` below the `recordingController` import, and replace `onResume` with:

```tsx
  const onResume = useCallback(async () => {
    try {
      const result = await resumeRecording()
      if (result !== 'resumed') {
        const { title, message } = captureRefusalAlert(result, 'resume')
        Alert.alert(title, message)
      }
    } catch {
      Alert.alert('Could not resume recording', 'Something went wrong. Please try again.')
    }
  }, [])
```

- [ ] **Step 6: Run the gate**

Run: `npm run verify`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/recording/captureAlerts.ts src/recording/__tests__/captureAlerts.test.ts \
  src/map/RecordButton.tsx src/map/PausedControls.tsx
git commit -m "$(cat <<'EOF'
feat(recording): explain a refused start or resume with the same alerts

Claude-Session: https://claude.ai/code/session_01T6bQLYpvuUQoNU2hCv8zbp
EOF
)"
```

---

## Device verification (hand-off to the user after Task 4)

A release build is enough (no native change); the migration runs on launch. The spec's `## Device verification`:

1. Pause, switch location off, walk 100 m, switch location on, resume, walk → two separate segments, no line across.
2. Pause, switch location off, resume → the enable-location dialog; decline → *"Location is off — Turn on location to resume recording."*, still paused.
3. Accept the dialog → resumes; walking draws a new segment starting where you are.
4. Paused and moved with location on, resume immediately → no line from the pause point.
5. Location off, Record → unchanged: the dialog, and declining shows the start alert.
