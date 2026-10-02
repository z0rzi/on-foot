# Debug Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The app keeps its own durable record of what it did, readable and shareable from Settings, so a bug noticed on a hike can be diagnosed afterwards without a cable — starting with FIELD-2, the recording sheet that is sometimes missing after reopening the app.

**Architecture:** A `debug_log` table behind the persistence seam (leaf types + repository interface in `src/data/log/`, drizzle implementation in `src/data/db/`), written through one fire-and-forget `logEvent` in `src/log/` whose writes are serialised by the queue this plan extracts from `recordingController`'s existing chain. Everything decided in pure functions (`retentionCutoff`, `fixBatchSummary`, `logExportText`, `logLine`) and TDD'd; the screen is device-verified. The log never records latitude or longitude.

**Tech Stack:** React Native 0.86.2 / Expo SDK 57 (`~57.0.14`), TypeScript 6, zustand, drizzle-orm `^0.45.2` + expo-sqlite (drizzle-kit migrations), Jest 29 via jest-expo.

**Spec:** `docs/superpowers/specs/2026-09-18-onfoot-rn-debug-log-design.md`

## Global Constraints

- `type LogLevel = 'info' | 'warn' | 'error'`; `type LogArea = 'recording' | 'capture' | 'launch' | 'map' | 'error'`. Exact strings; they are persisted.
- Table `debug_log`, migration **0007**, columns `id`, `t`, `level`, `area`, `message`, `detail` (nullable), with an index on `t`.
- **Fire and forget.** `logEvent` returns `void`, never throws, and no caller awaits it. A storage failure is dropped.
- **Ordered.** Entries reach the repository in the order they were logged, even when two events race.
- **Never coordinates.** No latitude or longitude is ever written to the log, in any area. A test asserts `fixBatchSummary`'s output carries none.
- Retention: the last **7 days**, capped at the newest **5,000** entries, trimmed **once per launch**.
- Export cap: **200,000 characters**, ending with a line saying how many entries were left out.
- `detail` is compact JSON (`JSON.stringify`, no spacing); a value that cannot be serialised leaves `detail` null rather than throwing.
- **No new dependency.** The export header uses React Native's `Platform` and the already-declared `expo-constants`; sharing uses React Native's `Share`.
- Code style: no semicolons, single quotes, 2-space indent, no JSDoc (see `AGENTS.md` on comments — comment *why*, never the change).

## Two spec gaps this plan closes

The spec's `## Existing shape` section missed both; each is a task here rather than an improvisation at implementation time.

1. **The ordering mechanism already exists.** `src/recording/recordingController.ts:36-41` has `exclusive()` over a `tail` promise. `logEvent`'s "writes are queued one after another" is the *second* instance of that shape, so `AGENTS.md`'s rule applies: name the first instance and extract what is shared. Task 1 extracts `createSerialQueue()` — a **factory**, so the log's queue and the recording chain stay independent (a log write must never wait behind a recording turn, nor the reverse).
2. **`LocationFix` carries no accuracy.** The spec's `fixBatchSummary` reports "the best accuracy", but `src/location/types.ts`'s `LocationFix` is `{ lat, lng, ele, t }`. Task 5 adds `accuracy: number | null` to the port and maps it in the seam's adapter. Without it the summary cannot explain a 500 m GPS jump, which is half of why the log exists.

## File structure

| File | Responsibility |
|---|---|
| `src/async/serialQueue.ts` (new) | `createSerialQueue()` — one-at-a-time execution, shared by the recording chain and the log writer |
| `src/data/log/types.ts` (new) | Leaf types: `LogLevel`, `LogArea`, `LogEntry`, `NewLogEntry` |
| `src/data/log/repository.ts` (new) | `LogRepository` interface |
| `src/data/log/mapping.ts` (new) | Row ↔ entry mapping, including `detail` JSON encode/decode |
| `src/data/log/index.ts` (new) | Wires `logRepository` to the sqlite implementation; re-exports types |
| `src/data/db/schema.ts` (modify) | The `debug_log` table + its index on `t` |
| `src/data/db/logRepository.ts` (new) | Drizzle implementation: `append`, `list`, `trim`, `clear` |
| `src/log/logEvent.ts` (new) | The writer: fire-and-forget, ordered, swallowing |
| `src/log/retention.ts` (new) | `retentionCutoff(now)`; `LOG_RETENTION_DAYS`, `LOG_MAX_ENTRIES` |
| `src/log/useLogRetention.ts` (new) | Trims once per launch |
| `src/log/fixBatchSummary.ts` (new) | Summarises a batch of fixes, with no coordinates |
| `src/log/deviceInfo.ts` (new) | App version, phone model, Android version for the export header |
| `src/log/logExportText.ts` (new) | `logLine`, `logExportText` — the shared text, newest first, capped |
| `src/log/index.ts` (new) | The module's public surface: `logEvent` + types |
| `src/log/LogList.tsx` (new) | The viewer's list, Share and Clear |
| `app/settings/log.tsx` (new) | The screen, following `app/settings/offline.tsx` |
| `app/(tabs)/settings.tsx` (modify) | A "Debug log" navigation row beside "Offline maps" |
| `src/location/types.ts`, `src/location/expoLocation.ts` (modify) | `LocationFix.accuracy` |
| `src/activities/format.ts` (modify) | `formatClockSeconds` — the log's `HH:MM:SS`, beside the existing `HH:MM` clock |
| `src/recording/recordingController.ts` (modify) | Uses `createSerialQueue`; logs recording and capture |
| `src/recording/locationTask.ts` (modify) | Logs each batch of fixes |
| `src/recording/useResumeRecording.ts` (modify) | Logs the launch decision |
| `src/map/MapScreen.tsx` (modify) | Logs map mode, sheet mount, and `sheetTop` on app-active (FIELD-2) |
| `src/components/ErrorBoundary.tsx` (modify) | Logs its catch |
| `app/_layout.tsx` (modify) | Installs the global error handler; mounts the retention trim |
| `AGENTS.md`, `docs/architecture/debug-log.md` | Documentation |

---

### Task 1: One serial queue for the recording chain and the log writer

**Files:**
- Create: `src/async/serialQueue.ts`
- Create: `src/async/__tests__/serialQueue.test.ts`
- Modify: `src/recording/recordingController.ts:36-41` (replace the local `tail`/`exclusive` with the shared factory)

**Interfaces:**
- Consumes: nothing.
- Produces: `createSerialQueue(): <T>(operation: () => Promise<T>) => Promise<T>` — each call runs after the previous one settles, resolves or rejects with its own operation's outcome, and a rejection never stops the queue.

- [ ] **Step 1: Write the failing test**

Create `src/async/__tests__/serialQueue.test.ts`:

```ts
import { createSerialQueue } from '../serialQueue'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

describe('createSerialQueue', () => {
  it('runs operations one at a time, in the order they were queued', async () => {
    const run = createSerialQueue()
    const order: string[] = []
    const first = deferred<void>()
    const second = deferred<void>()

    const a = run(async () => { order.push('a:start'); await first.promise; order.push('a:end') })
    const b = run(async () => { order.push('b:start'); await second.promise; order.push('b:end') })

    expect(order).toEqual(['a:start'])
    first.resolve()
    await a
    expect(order).toEqual(['a:start', 'a:end', 'b:start'])
    second.resolve()
    await b
    expect(order).toEqual(['a:start', 'a:end', 'b:start', 'b:end'])
  })

  it('keeps running after an operation rejects, and gives the rejection to its own caller', async () => {
    const run = createSerialQueue()
    const failing = run(async () => { throw new Error('nope') })
    const after = run(async () => 'ran')

    await expect(failing).rejects.toThrow('nope')
    await expect(after).resolves.toBe('ran')
  })

  it('gives each queue its own chain, so one cannot block another', async () => {
    const slow = createSerialQueue()
    const fast = createSerialQueue()
    const blocker = deferred<void>()

    const blocked = slow(() => blocker.promise)
    await expect(fast(async () => 'free')).resolves.toBe('free')

    blocker.resolve()
    await blocked
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/async --silent`
Expected: FAIL — `Cannot find module '../serialQueue'`.

- [ ] **Step 3: Implement the queue**

Create `src/async/serialQueue.ts`. This is the mechanism `recordingController` has used since the stream-health work; the comment says what it guarantees, not what moved.

```ts
// One-at-a-time execution: each operation starts only once the previous one has settled, so two
// callers never interleave. A rejection reaches its own caller and leaves the queue usable. Each
// queue is independent — callers that must not wait behind each other create their own.
export function createSerialQueue() {
  let tail: Promise<unknown> = Promise.resolve()
  return <T>(operation: () => Promise<T>): Promise<T> => {
    const turn = tail.then(operation, operation)
    tail = turn.catch(() => {})
    return turn
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/async --silent`
Expected: PASS (3 tests).

- [ ] **Step 5: Route the recording chain through it**

In `src/recording/recordingController.ts`, delete these lines:

```ts
let tail: Promise<unknown> = Promise.resolve()

function exclusive<T>(operation: () => Promise<T>): Promise<T> {
  const turn = tail.then(operation, operation)
  tail = turn.catch(() => {})
  return turn
}
```

Replace them with:

```ts
const exclusive = createSerialQueue()
```

Add the import beside the other `src/` imports at the top of the file:

```ts
import { createSerialQueue } from '../async/serialQueue'
```

Leave the long comment above it untouched — it explains the chain's *semantics* (every turn re-reads what it acts on), which the extraction does not change.

- [ ] **Step 6: Run the gate**

Run: `npm run verify`
Expected: exit 0. `recordingController.test.ts` already pins the chain's behaviour (a second caller parks behind the first), so it is the regression test for this refactor.

- [ ] **Step 7: Commit**

```bash
git add src/async/serialQueue.ts src/async/__tests__/serialQueue.test.ts src/recording/recordingController.ts
git commit -m "refactor(async): extract the serial queue the recording chain and the log writer share"
```

---

### Task 2: The debug_log table, its types and its repository

**Files:**
- Create: `src/data/log/types.ts`, `src/data/log/repository.ts`, `src/data/log/mapping.ts`, `src/data/log/index.ts`
- Create: `src/data/log/__tests__/mapping.test.ts`
- Create: `src/data/db/logRepository.ts`
- Modify: `src/data/db/schema.ts`
- Generated: `src/data/db/migrations/0007_*.sql`, `src/data/db/migrations/meta/*`, `src/data/db/migrations/migrations.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type LogLevel = 'info' | 'warn' | 'error'`, `type LogArea = 'recording' | 'capture' | 'launch' | 'map' | 'error'`
  - `interface LogEntry { id: number; t: number; level: LogLevel; area: LogArea; message: string; detail: string | null }`
  - `interface NewLogEntry { t: number; level: LogLevel; area: LogArea; message: string; detail: string | null }`
  - `encodeDetail(detail: Record<string, unknown> | undefined): string | null`
  - `interface LogRepository { append(entry: NewLogEntry): Promise<void>; list(limit: number): Promise<LogEntry[]>; trim(cutoff: number, maxEntries: number): Promise<void>; clear(): Promise<void> }`
  - `logRepository: LogRepository` from `src/data/log`

- [ ] **Step 1: Write the failing test for the one pure part**

The repository implementation is the persistence seam and is device-verified like its siblings; the mapping is pure and gets the test. Create `src/data/log/__tests__/mapping.test.ts`:

```ts
import { encodeDetail } from '../mapping'

describe('encodeDetail', () => {
  it('encodes a detail object as compact JSON', () => {
    expect(encodeDetail({ a: 1, b: 'two' })).toBe('{"a":1,"b":"two"}')
  })

  it('is null when there is no detail', () => {
    expect(encodeDetail(undefined)).toBeNull()
  })

  it('is null rather than throwing when the value cannot be serialised', () => {
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    expect(encodeDetail(cyclic)).toBeNull()
  })

  it('is null when the value serialises to nothing', () => {
    expect(encodeDetail({ fn: () => 1 })).toBe('{}')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/data/log --silent`
Expected: FAIL — `Cannot find module '../mapping'`.

- [ ] **Step 3: Write the types, the interface and the mapping**

Create `src/data/log/types.ts`:

```ts
export type LogLevel = 'info' | 'warn' | 'error'
export type LogArea = 'recording' | 'capture' | 'launch' | 'map' | 'error'

export interface LogEntry {
  id: number
  t: number
  level: LogLevel
  area: LogArea
  message: string
  detail: string | null
}

export interface NewLogEntry {
  t: number
  level: LogLevel
  area: LogArea
  message: string
  detail: string | null
}
```

Create `src/data/log/repository.ts`:

```ts
import { LogEntry, NewLogEntry } from './types'

export interface LogRepository {
  append(entry: NewLogEntry): Promise<void>
  list(limit: number): Promise<LogEntry[]>
  trim(cutoff: number, maxEntries: number): Promise<void>
  clear(): Promise<void>
}
```

Create `src/data/log/mapping.ts`:

```ts
import { LogArea, LogEntry, LogLevel } from './types'

// A log that breaks the app would be worse than no log, so an unserialisable detail is dropped.
export function encodeDetail(detail: Record<string, unknown> | undefined): string | null {
  if (detail === undefined) return null
  try {
    return JSON.stringify(detail) ?? null
  } catch {
    return null
  }
}

export function rowToEntry(row: {
  id: number
  t: number
  level: string
  area: string
  message: string
  detail: string | null
}): LogEntry {
  return {
    id: row.id,
    t: row.t,
    level: row.level as LogLevel,
    area: row.area as LogArea,
    message: row.message,
    detail: row.detail,
  }
}
```

The two casts in `rowToEntry` read a column this app is the only writer of, the same way `rowToSession` and `rowToActivity` read their enum columns; a row written by an older version with a retired name would widen, not break, the viewer.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/data/log --silent`
Expected: PASS (4 tests).

- [ ] **Step 5: Add the table to the schema**

In `src/data/db/schema.ts`, add `index` to the drizzle import:

```ts
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
```

Append the table at the end of the file:

```ts
// The index on t serves both the newest-first viewer and the retention trim.
export const debugLog = sqliteTable(
  'debug_log',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    t: integer('t').notNull(),
    level: text('level').notNull(),
    area: text('area').notNull(),
    message: text('message').notNull(),
    detail: text('detail'),
  },
  (table) => ({
    tIndex: index('debug_log_t_idx').on(table.t),
  }),
)
```

- [ ] **Step 6: Generate the migration**

Run: `npm run db:generate`
Expected: a new `src/data/db/migrations/0007_<two words>.sql` creating `debug_log` and `debug_log_t_idx`, a new `meta/0007_snapshot.json`, and `migrations.js` updated to include it. The generated file name is drizzle-kit's own (it picks the words) — use whatever it produces, do not rename it.

Read the generated `.sql` and confirm it contains `CREATE TABLE \`debug_log\`` and `CREATE INDEX \`debug_log_t_idx\`` and nothing else. If it contains any `ALTER` or `DROP` touching another table, stop — the snapshot is out of date and something else is uncommitted.

- [ ] **Step 7: Implement the repository**

Create `src/data/db/logRepository.ts`:

```ts
import { desc, lt, notInArray } from 'drizzle-orm'
import { LogRepository } from '../log/repository'
import { rowToEntry } from '../log/mapping'
import { db } from './client'
import { debugLog } from './schema'

export const sqliteLogRepository: LogRepository = {
  async append(entry) {
    await db.insert(debugLog).values(entry)
  },
  async list(limit) {
    const rows = await db
      .select()
      .from(debugLog)
      .orderBy(desc(debugLog.t), desc(debugLog.id))
      .limit(limit)
    return rows.map(rowToEntry)
  },
  async trim(cutoff, maxEntries) {
    await db.delete(debugLog).where(lt(debugLog.t, cutoff))
    const keep = db
      .select({ id: debugLog.id })
      .from(debugLog)
      .orderBy(desc(debugLog.t), desc(debugLog.id))
      .limit(maxEntries)
    await db.delete(debugLog).where(notInArray(debugLog.id, keep))
  },
  async clear() {
    await db.delete(debugLog)
  },
}
```

`notInArray` with a subquery is how the newest N rows are kept — no raw SQL.

Create `src/data/log/index.ts`:

```ts
import { sqliteLogRepository } from '../db/logRepository'
import { LogRepository } from './repository'

export const logRepository: LogRepository = sqliteLogRepository

export * from './types'
export * from './repository'
```

- [ ] **Step 8: Run the gate**

Run: `npm run verify`
Expected: exit 0. In particular the seams test must stay green: `src/data/log/` holds no `expo-sqlite`/`drizzle-orm` import, only `src/data/db/logRepository.ts` does.

- [ ] **Step 9: Commit**

```bash
git add src/data/log src/data/db/schema.ts src/data/db/logRepository.ts src/data/db/migrations
git commit -m "feat(log): add the debug_log table behind a repository of its own"
```

---

### Task 3: logEvent — ordered, fire-and-forget, swallowing

**Files:**
- Create: `src/log/logEvent.ts`, `src/log/index.ts`
- Create: `src/log/__tests__/logEvent.test.ts`

**Interfaces:**
- Consumes: `logRepository` and the types from Task 2; `createSerialQueue` from Task 1.
- Produces: `logEvent(level: LogLevel, area: LogArea, message: string, detail?: Record<string, unknown>): void`, and `flushLog(): Promise<void>` used only by tests to await the queue.

- [ ] **Step 1: Write the failing tests**

Create `src/log/__tests__/logEvent.test.ts`:

```ts
jest.mock('../../data/log', () => ({ logRepository: { append: jest.fn() } }))

import { logRepository } from '../../data/log'
import { flushLog, logEvent } from '../logEvent'

const append = jest.mocked(logRepository.append)

describe('logEvent', () => {
  beforeEach(() => {
    append.mockReset()
    append.mockResolvedValue(undefined)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('writes the level, area, message and the time it was logged', async () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    logEvent('info', 'recording', 'start requested')
    await flushLog()

    expect(append).toHaveBeenCalledWith({
      t: 1_700_000_000_000,
      level: 'info',
      area: 'recording',
      message: 'start requested',
      detail: null,
    })

    nowSpy.mockRestore()
  })

  it('encodes detail as compact JSON', async () => {
    logEvent('warn', 'capture', 'stream refused', { reason: 'location-off' })
    await flushLog()

    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ detail: '{"reason":"location-off"}' }),
    )
  })

  it('reaches the repository in the order the entries were logged', async () => {
    let firstSettled = false
    const callOrder: string[] = []

    append.mockImplementation(async (entry) => {
      if ((entry.message === 'second' || entry.message === 'third') && !firstSettled) {
        throw new Error(`${entry.message} was invoked before first settled`)
      }

      callOrder.push(entry.message)

      if (entry.message === 'first') {
        await new Promise(resolve => setTimeout(resolve, 100))
        firstSettled = true
      }
    })

    logEvent('info', 'recording', 'first')
    logEvent('info', 'recording', 'second')
    logEvent('info', 'recording', 'third')
    await flushLog()

    expect(callOrder).toEqual(['first', 'second', 'third'])
  })

  it('swallows a repository failure and still writes the next entry', async () => {
    append.mockRejectedValueOnce(new Error('disk gone'))

    logEvent('info', 'recording', 'doomed')
    logEvent('info', 'recording', 'survivor')
    await expect(flushLog()).resolves.toBeUndefined()

    expect(append).toHaveBeenCalledTimes(2)
    expect(append).toHaveBeenLastCalledWith(expect.objectContaining({ message: 'survivor' }))
  })

  it('returns nothing, so no caller can await it', () => {
    expect(logEvent('info', 'map', 'mode changed')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/log --silent`
Expected: FAIL — `Cannot find module '../logEvent'`.

- [ ] **Step 3: Implement the writer**

Create `src/log/logEvent.ts`:

```ts
import { createSerialQueue } from '../async/serialQueue'
import { LogArea, LogLevel, logRepository } from '../data/log'
import { encodeDetail } from '../data/log/mapping'

// The log's own queue, not the recording chain's: a log write must never wait behind a recording
// turn, nor hold one up.
const queue = createSerialQueue()
let pending: Promise<unknown> = Promise.resolve()

export function logEvent(
  level: LogLevel,
  area: LogArea,
  message: string,
  detail?: Record<string, unknown>,
): void {
  const entry = { t: Date.now(), level, area, message, detail: encodeDetail(detail) }
  pending = queue(() => logRepository.append(entry)).catch(() => {})
}

// Tests await the queue; nothing in the app does.
export function flushLog(): Promise<void> {
  return pending.then(() => undefined)
}
```

Create `src/log/index.ts`:

```ts
export { logEvent } from './logEvent'
export type { LogArea, LogEntry, LogLevel } from '../data/log'
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/log --silent`
Expected: PASS (5 tests).

- [ ] **Step 5: Run the gate**

Run: `npm run verify`
Expected: exit 0. The cycles test matters here: `src/log/` imports `src/data/log/`, never the reverse — nothing under `src/data/` may import `src/log/`.

- [ ] **Step 6: Commit**

```bash
git add src/log/logEvent.ts src/log/index.ts src/log/__tests__/logEvent.test.ts
git commit -m "feat(log): write entries in order, fire and forget"
```

---

### Task 4: Retention — 7 days, 5,000 entries, trimmed once per launch

**Files:**
- Create: `src/log/retention.ts`, `src/log/useLogRetention.ts`
- Create: `src/log/__tests__/retention.test.ts`
- Modify: `app/_layout.tsx`

**Interfaces:**
- Consumes: `logRepository.trim` (Task 2).
- Produces: `LOG_RETENTION_DAYS = 7`, `LOG_MAX_ENTRIES = 5000`, `retentionCutoff(now: number): number`, `useLogRetention(): void`.

- [ ] **Step 1: Write the failing test**

Create `src/log/__tests__/retention.test.ts`:

```ts
import { LOG_MAX_ENTRIES, LOG_RETENTION_DAYS, retentionCutoff } from '../retention'

describe('retentionCutoff', () => {
  it('is seven days before the given instant', () => {
    const now = Date.parse('2026-10-02T12:00:00.000Z')
    expect(retentionCutoff(now)).toBe(Date.parse('2026-09-25T12:00:00.000Z'))
  })

  it('keeps the documented limits', () => {
    expect(LOG_RETENTION_DAYS).toBe(7)
    expect(LOG_MAX_ENTRIES).toBe(5000)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/log/__tests__/retention --silent`
Expected: FAIL — `Cannot find module '../retention'`.

- [ ] **Step 3: Implement retention**

Create `src/log/retention.ts`:

```ts
export const LOG_RETENTION_DAYS = 7
export const LOG_MAX_ENTRIES = 5000

const DAY_MS = 24 * 60 * 60 * 1000

export function retentionCutoff(now: number): number {
  return now - LOG_RETENTION_DAYS * DAY_MS
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/log/__tests__/retention --silent`
Expected: PASS (2 tests).

- [ ] **Step 5: Trim once per launch**

Create `src/log/useLogRetention.ts`:

```ts
import { useEffect } from 'react'
import { logRepository } from '../data/log'
import { LOG_MAX_ENTRIES, retentionCutoff } from './retention'

export function useLogRetention(): void {
  useEffect(() => {
    logRepository.trim(retentionCutoff(Date.now()), LOG_MAX_ENTRIES).catch(() => {})
  }, [])
}
```

In `app/_layout.tsx`, add the handler component beside the existing ones:

```tsx
function LogRetentionHandler() {
  useLogRetention()
  return null
}
```

Import it at the top:

```ts
import { useLogRetention } from '../src/log/useLogRetention'
```

And mount it inside the `BottomSheetModalProvider`, after `OfflineInitHandler`:

```tsx
<LogRetentionHandler />
```

It sits inside the `success ?` branch, so the trim runs only once migrations have applied — the table exists by then.

- [ ] **Step 6: Run the gate**

Run: `npm run verify`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/log/retention.ts src/log/useLogRetention.ts src/log/__tests__/retention.test.ts app/_layout.tsx
git commit -m "feat(log): keep seven days and five thousand entries, trimmed on launch"
```

---

### Task 5: The location port carries accuracy, and fixBatchSummary uses it

**Files:**
- Modify: `src/location/types.ts:1-6`, `src/location/expoLocation.ts:12-19`
- Modify: `src/activities/format.ts` (a seconds-precision clock, beside `formatClockTime`)
- Modify: `src/activities/__tests__/format.test.ts` (or create it if absent)
- Create: `src/log/fixBatchSummary.ts`
- Create: `src/log/__tests__/fixBatchSummary.test.ts`

**Interfaces:**
- Consumes: `LocationFix` from `src/location`, `haversineMeters` from `src/data/geo/metrics`.
- Produces:
  - `formatClockSeconds(timestamp: number): string` — `HH:MM:SS`
  - `fixBatchSummary(fixes: LocationFix[], kept: LocationFix[], previous: { lat: number; lng: number } | null): Record<string, unknown>` — `{ arrived, kept, dropped, firstAt, lastAt, bestAccuracy, metresFromPrevious }`, `firstAt`/`lastAt` as `HH:MM:SS` strings, no coordinate anywhere.

- [ ] **Step 1: Write the failing test for a seconds-precision clock**

The app's `formatClockTime` (`src/activities/format.ts:56-59`) renders `HH:MM` — correct for the interruption toast, useless for a log where two events a few seconds apart must be orderable by eye. The log needs seconds, and the spec's viewer says `HH:MM:SS`. It goes beside `formatClockTime` rather than in `src/log/`: one home for clock formatting, so that when backlog item 8 moves the formatters into a presentation module, both move together.

Add to `src/activities/__tests__/format.test.ts` (create the file with this one `describe` if it does not exist):

```ts
import { formatClockSeconds } from '../format'

describe('formatClockSeconds', () => {
  it('pads hours, minutes and seconds to two digits each', () => {
    const t = new Date(2026, 9, 2, 9, 5, 7).getTime()
    expect(formatClockSeconds(t)).toBe('09:05:07')
  })

  it('renders an afternoon time on the 24-hour clock', () => {
    const t = new Date(2026, 9, 2, 14, 49, 30).getTime()
    expect(formatClockSeconds(t)).toBe('14:49:30')
  })
})
```

The timestamps are built with the local-time `Date` constructor on purpose: `formatClockTime` already uses `getHours()`, so the log reads in the hiker's own clock, and the test must not depend on the runner's timezone.

- [ ] **Step 2: Implement it**

Append to `src/activities/format.ts`:

```ts
export function formatClockSeconds(timestamp: number): string {
  const d = new Date(timestamp)
  const two = (n: number) => n.toString().padStart(2, '0')
  return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`
}
```

Run: `npx jest src/activities/__tests__/format --silent`
Expected: PASS.

- [ ] **Step 3: Write the failing test for the summary**

Create `src/log/__tests__/fixBatchSummary.test.ts`:

```ts
import { fixBatchSummary } from '../fixBatchSummary'

const fix = (t: number, accuracy: number | null, lat = 45.1, lng = 6.1) => ({ lat, lng, ele: 1000, t, accuracy })

describe('fixBatchSummary', () => {
  it('reports what arrived, what was kept and what was dropped', () => {
    const arrived = [fix(1_700_000_000_000, 8), fix(1_700_000_030_000, 12)]
    const kept = [arrived[1]]

    expect(fixBatchSummary(arrived, kept, null)).toEqual(
      expect.objectContaining({ arrived: 2, kept: 1, dropped: 1 }),
    )
  })

  it('reports the first and last time to the second', () => {
    const arrived = [
      fix(new Date(2026, 9, 2, 9, 15, 0).getTime(), 5),
      fix(new Date(2026, 9, 2, 9, 17, 30).getTime(), 5),
    ]
    const summary = fixBatchSummary(arrived, arrived, null)

    expect(summary.firstAt).toBe('09:15:00')
    expect(summary.lastAt).toBe('09:17:30')
  })

  it('reports the best accuracy in the batch, and null when none is known', () => {
    expect(fixBatchSummary([fix(1, 20), fix(2, 7)], [], null).bestAccuracy).toBe(7)
    expect(fixBatchSummary([fix(1, null)], [], null).bestAccuracy).toBeNull()
  })

  it('reports whole metres from the previous stored point', () => {
    const kept = [fix(1, 5, 45.0, 6.0)]
    const summary = fixBatchSummary(kept, kept, { lat: 45.001, lng: 6.0 })

    expect(summary.metresFromPrevious).toBe(111)
  })

  it('has no distance to report with no previous point', () => {
    const kept = [fix(1, 5)]
    expect(fixBatchSummary(kept, kept, null).metresFromPrevious).toBeNull()
  })

  it('carries no coordinate, so the log can never place the user', () => {
    const kept = [fix(1, 5, 45.123456, 6.654321)]
    const serialised = JSON.stringify(fixBatchSummary(kept, kept, { lat: 45.2, lng: 6.7 }))

    expect(serialised).not.toContain('45.1')
    expect(serialised).not.toContain('6.65')
    expect(serialised).not.toMatch(/lat|lng/i)
  })

  it('is empty-safe for a delivery that arrived with nothing', () => {
    expect(fixBatchSummary([], [], null)).toEqual(
      expect.objectContaining({ arrived: 0, kept: 0, dropped: 0, firstAt: null, lastAt: null }),
    )
  })
})
```

The 111 m expectation is 0.001° of latitude; keep the assertion exact — if `haversineMeters` disagrees, read it and fix the expectation to what the project's own formula gives, do not loosen the test to a range.

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx jest src/log/__tests__/fixBatchSummary --silent`
Expected: FAIL — `Cannot find module '../fixBatchSummary'`.

- [ ] **Step 5: Add accuracy to the port**

In `src/location/types.ts`:

```ts
export interface LocationFix {
  lat: number
  lng: number
  ele: number | null
  t: number
  accuracy: number | null
}
```

In `src/location/expoLocation.ts:12-19`, `toLocationFix` is the one place that knows expo-location's shape. `LocationObjectCoords.accuracy` is already `number | null` (the radius of uncertainty in metres), so it maps across exactly like `altitude` does, with no fallback:

```ts
export function toLocationFix(location: Location.LocationObject): LocationFix {
  return {
    lat: location.coords.latitude,
    lng: location.coords.longitude,
    ele: location.coords.altitude,
    t: Math.round(location.timestamp),
    accuracy: location.coords.accuracy,
  }
}
```

`tsc` will now point at every place a `LocationFix` is constructed — fixtures in `src/recording/__tests__/` and `src/location/__tests__/` among them. Add `accuracy: null` to each; it is a field the tests do not exercise.

- [ ] **Step 6: Implement the summary**

Create `src/log/fixBatchSummary.ts`:

```ts
import { LocationFix } from '../location'
import { haversineMeters } from '../data/geo/metrics'
import { formatClockSeconds } from '../activities/format'

// Accuracy and a distance are enough to recognise a bad fix; a coordinate would turn the log into a
// record of where the user has been, which it must never be.
export function fixBatchSummary(
  arrived: LocationFix[],
  kept: LocationFix[],
  previous: { lat: number; lng: number } | null,
): Record<string, unknown> {
  const accuracies = arrived.map((f) => f.accuracy).filter((a): a is number => a !== null)
  const first = kept[0] ?? null
  return {
    arrived: arrived.length,
    kept: kept.length,
    dropped: arrived.length - kept.length,
    firstAt: arrived.length ? formatClockSeconds(arrived[0].t) : null,
    lastAt: arrived.length ? formatClockSeconds(arrived[arrived.length - 1].t) : null,
    bestAccuracy: accuracies.length ? Math.min(...accuracies) : null,
    metresFromPrevious:
      previous && first ? Math.round(haversineMeters(previous.lat, previous.lng, first.lat, first.lng)) : null,
  }
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx jest src/log/__tests__/fixBatchSummary --silent`
Expected: PASS (7 tests).

- [ ] **Step 8: Run the gate**

Run: `npm run verify`
Expected: exit 0, with every `LocationFix` fixture updated.

- [ ] **Step 9: Commit**

```bash
git add src/location/types.ts src/location/expoLocation.ts src/activities/format.ts src/activities/__tests__ src/log/fixBatchSummary.ts src/log/__tests__/fixBatchSummary.test.ts src/recording/__tests__ src/location/__tests__
git commit -m "feat(location,log): carry a fix's accuracy and summarise a batch without coordinates"
```

---

### Task 6: The export text and its header

**Files:**
- Create: `src/log/deviceInfo.ts`, `src/log/logExportText.ts`
- Create: `src/log/__tests__/logExportText.test.ts`

**Interfaces:**
- Consumes: `LogEntry` (Task 2).
- Produces:
  - `interface LogExportMeta { appVersion: string; model: string; androidVersion: string }`
  - `deviceInfo(): LogExportMeta`
  - `logLine(entry: LogEntry): string`
  - `LOG_EXPORT_MAX_CHARS = 200000`
  - `logExportText(entries: LogEntry[], meta: LogExportMeta): string`

- [ ] **Step 1: Write the failing tests**

Create `src/log/__tests__/logExportText.test.ts`:

```ts
import { LogEntry } from '../../data/log'
import { LOG_EXPORT_MAX_CHARS, logExportText, logLine } from '../logExportText'

const META = { appVersion: '1.0.0', model: 'DN2103', androidVersion: '13' }

const entry = (id: number, t: number, over: Partial<LogEntry> = {}): LogEntry => ({
  id,
  t,
  level: 'info',
  area: 'recording',
  message: `message ${id}`,
  detail: null,
  ...over,
})

describe('logLine', () => {
  it('carries the clock time, level, area and message', () => {
    const line = logLine(entry(1, Date.parse('2026-10-02T09:15:00Z')))
    expect(line).toContain('info')
    expect(line).toContain('recording')
    expect(line).toContain('message 1')
  })

  it('appends the detail json when there is one', () => {
    expect(logLine(entry(1, 0, { detail: '{"reason":"location-off"}' }))).toContain('{"reason":"location-off"}')
  })
})

describe('logExportText', () => {
  it('heads the text with the app version, the phone model and the android version', () => {
    const text = logExportText([entry(1, 0)], META)
    const header = text.split('\n')[0]

    expect(header).toContain('1.0.0')
    expect(header).toContain('DN2103')
    expect(header).toContain('13')
  })

  it('lists entries newest first', () => {
    const text = logExportText(
      [entry(1, 1_000), entry(2, 5_000), entry(3, 3_000)],
      META,
    )
    const body = text.split('\n').filter((l) => l.includes('message'))

    expect(body.map((l) => l.match(/message \d/)?.[0])).toEqual(['message 2', 'message 3', 'message 1'])
  })

  it('stays within the cap and says how many entries were left out', () => {
    const many = Array.from({ length: 20_000 }, (_, i) => entry(i + 1, i + 1, { message: 'x'.repeat(40) }))
    const text = logExportText(many, META)

    expect(text.length).toBeLessThanOrEqual(LOG_EXPORT_MAX_CHARS)
    expect(text).toMatch(/\d+ older entries not included/)
  })

  it('says nothing about omissions when everything fits', () => {
    expect(logExportText([entry(1, 0)], META)).not.toContain('not included')
  })

  it('reads as a header and nothing else when there is no entry', () => {
    const text = logExportText([], META)
    expect(text).toContain('1.0.0')
    expect(text).not.toContain('not included')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/log/__tests__/logExportText --silent`
Expected: FAIL — `Cannot find module '../logExportText'`.

- [ ] **Step 3: Implement the export**

Create `src/log/logExportText.ts`:

```ts
import { LogEntry } from '../data/log'
import { formatClockSeconds } from '../activities/format'

export const LOG_EXPORT_MAX_CHARS = 200_000

export interface LogExportMeta {
  appVersion: string
  model: string
  androidVersion: string
}

export function logLine(entry: LogEntry): string {
  const head = `${formatClockSeconds(entry.t)} ${entry.level} ${entry.area} ${entry.message}`
  return entry.detail ? `${head} ${entry.detail}` : head
}

function omittedFooter(omitted: number): string {
  return omitted > 0 ? `\n… ${omitted} older entries not included` : ''
}

// A share intent over the system's limit fails silently, so the text is capped and says what it left
// out rather than arriving truncated mid-line. A candidate line is measured against the footer that
// would follow it if it were the last one kept, not the footer for leaving it out — otherwise a line
// landing exactly on the boundary gets rejected to make room for a footer it turns out not to need.
export function logExportText(entries: LogEntry[], meta: LogExportMeta): string {
  const header = `On Foot ${meta.appVersion} · ${meta.model} · Android ${meta.androidVersion}`
  const newestFirst = [...entries].sort((a, b) => b.t - a.t || b.id - a.id)

  const lines: string[] = []
  let length = header.length
  let included = 0
  for (const entry of newestFirst) {
    const line = logLine(entry)
    const footer = omittedFooter(newestFirst.length - included - 1)
    if (length + 1 + line.length + footer.length > LOG_EXPORT_MAX_CHARS) break
    lines.push(line)
    length += 1 + line.length
    included += 1
  }

  const body = [header, ...lines].join('\n')
  return `${body}${omittedFooter(newestFirst.length - included)}`
}
```

Create `src/log/deviceInfo.ts`:

```ts
import { Platform } from 'react-native'
import Constants from 'expo-constants'
import { LogExportMeta } from './logExportText'

// The model and the OS release come from React Native's own platform constants, typed per platform —
// no device library, and nothing to install. Android is the app's target; elsewhere the header still
// reads honestly rather than claiming a model it does not know.
export function deviceInfo(): LogExportMeta {
  return {
    appVersion: Constants.expoConfig?.version ?? 'unknown',
    model: Platform.OS === 'android' ? Platform.constants.Model : 'unknown',
    androidVersion: Platform.OS === 'android' ? Platform.constants.Release : 'unknown',
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/log/__tests__/logExportText --silent`
Expected: PASS (7 tests).

- [ ] **Step 5: Run the gate**

Run: `npm run verify`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/log/deviceInfo.ts src/log/logExportText.ts src/log/__tests__/logExportText.test.ts
git commit -m "feat(log): build the shared text, newest first, under the share cap"
```

---

### Task 7: What recording and capture log

**Files:**
- Modify: `src/recording/recordingController.ts`
- Modify: `src/recording/locationTask.ts`

**Interfaces:**
- Consumes: `logEvent` (Task 3), `fixBatchSummary` (Task 5).
- Produces: no new exports.

- [ ] **Step 1: Read the controller in full before touching it**

Run: `sed -n '1,240p' src/recording/recordingController.ts`

This file is the one the stream-health and resume-gate work hardened; its comments state invariants. Add log calls, change nothing else. Every call goes **inside** the existing control flow at the point the outcome is already known — never in a new branch, never inside a `catch` that currently has a deliberate empty body for a reason stated in a comment.

- [ ] **Step 2: Log the recording decisions**

Add the import:

```ts
import { logEvent } from '../log'
```

Then, at each point below, add one line. `startRecording`, after its result is decided and before it is returned — log the result it is about to return:

```ts
logEvent(result === 'started' ? 'info' : 'warn', 'recording', `start ${result}`)
```

`resumeRecording`, the same shape:

```ts
logEvent(result === 'resumed' ? 'info' : 'warn', 'recording', `resume ${result}`)
```

`pauseRecording`, after the pause is persisted:

```ts
logEvent('info', 'recording', 'paused')
```

`finishRecording`, after the activity is saved:

```ts
logEvent('info', 'recording', 'finished', { sessionId })
```

`discardRecording`, after the session is deleted:

```ts
logEvent('info', 'recording', 'discarded', { sessionId })
```

Where a new segment begins — the `applyResume` and `applyRelaunch` call sites — log the segment and when it began:

```ts
logEvent('info', 'recording', 'segment began', { segment: next.currentSegment, segmentStartedAt: next.segmentStartedAt })
```

Use the actual local variable the surrounding code already holds the updated session in; if it is not named `next`, use its name rather than introducing one.

- [ ] **Step 3: Log the capture decisions**

In `issueStream`, on the failure path, inside the existing `catch` and before its `return`:

```ts
logEvent('error', 'capture', 'stream start failed')
```

In `issueStream`, after the availability read that sets the store:

```ts
logEvent(available ? 'info' : 'warn', 'capture', available ? 'stream live' : 'stream stopped, no provider')
```

Where the stream is stopped deliberately:

```ts
logEvent('info', 'capture', 'stream stopped')
```

In `ensureCaptureReady`, where the readiness is decided:

```ts
logEvent(readiness === 'ready' ? 'info' : 'warn', 'capture', `capture ${readiness}`)
```

In the recovery trigger path, where the decision whether to re-issue is taken:

```ts
logEvent('info', 'capture', `recovery ${reissued ? 're-issued the stream' : 'left the live request alone'}`)
```

Use the names the surrounding code already has for the readiness value and the re-issue decision; if the decision is not held in a variable, log the two outcomes on their own branches rather than restructuring the code to create one.

- [ ] **Step 4: Log each batch of fixes**

Rewrite `src/recording/locationTask.ts` so the batch is summarised whether or not anything is kept — a delivery that arrives and is entirely dropped is exactly what the log needs to show:

```ts
import { defineBackgroundFixHandler } from '../location'
import { activitiesRepository } from '../data/activities'
import { logEvent } from '../log'
import { fixBatchSummary } from '../log/fixBatchSummary'
import { useRecordingStore } from './recordingStore'
import { fixesInSegment } from './session'

defineBackgroundFixHandler(async (fixes) => {
  const session = await activitiesRepository.getActiveSession()
  if (!session || session.pausedAt != null) {
    logEvent('info', 'capture', 'fixes ignored, no running session', { arrived: fixes.length })
    return
  }
  const segmentFixes = fixesInSegment(fixes, session.segmentStartedAt)
  // The previous stored point is what makes an implausible jump visible, and it is the only thing
  // read from it: a distance, never a position.
  const livePoints = useRecordingStore.getState().livePoints
  const previous = livePoints.length ? livePoints[livePoints.length - 1] : null
  logEvent('info', 'capture', 'fix batch', fixBatchSummary(fixes, segmentFixes, previous))
  if (segmentFixes.length === 0) return
  await activitiesRepository.appendPoints(session.id, session.currentSegment, segmentFixes)
  useRecordingStore.getState().appendLivePoints(session.currentSegment, segmentFixes)
})
```

`livePoints` is `LiveTrackPoint[]` on the store (`src/recording/recordingStore.ts:39`), already flat and in order, so the last element is the previous stored point — no store action and no new selector.

- [ ] **Step 5: Run the gate**

Run: `npm run verify`
Expected: exit 0. `recordingController.test.ts` and `locationTask.test.ts` mock the modules they need; add `jest.mock('../../log', () => ({ logEvent: jest.fn() }))` to each test file that now pulls the log in transitively, so no test writes to a real database.

- [ ] **Step 6: Commit**

```bash
git add src/recording/recordingController.ts src/recording/locationTask.ts src/recording/__tests__
git commit -m "feat(recording): log every recording and capture decision"
```

---

### Task 8: What launch, map and errors log

**Files:**
- Modify: `src/recording/useResumeRecording.ts`
- Modify: `src/map/MapScreen.tsx`
- Modify: `src/components/ErrorBoundary.tsx`
- Modify: `app/_layout.tsx`
- Create: `src/log/installGlobalErrorHandler.ts`

**Interfaces:**
- Consumes: `logEvent` (Task 3), `deviceInfo` (Task 6).
- Produces: `installGlobalErrorHandler(): void`.

- [ ] **Step 1: Log the launch and the action taken**

In `src/recording/useResumeRecording.ts`, log the version and the decision inside the existing effect, around the existing `resumeIfActive()` call:

```ts
logEvent('info', 'launch', 'cold start', { appVersion: deviceInfo().appVersion })
resumeIfActive()
  .then(({ action, sessionId }) => {
    logEvent('info', 'launch', `launch action ${action}`, { sessionId })
  })
  .catch((error: unknown) => {
    logEvent('error', 'launch', 'resume on launch failed', { error: String(error) })
  })
```

Keep whatever the existing `.catch` already does (it currently swallows); this adds the log beside it rather than replacing the behaviour. Add the two imports:

```ts
import { logEvent } from '../log'
import { deviceInfo } from '../log/deviceInfo'
```

The interruption notice is announced in `recordingController.ts:199` next to `showToast`; log the range it announced right there, so FIELD-3's "the toast is hidden and overstates the gap" has evidence even when the toast is never seen:

```ts
logEvent('warn', 'launch', 'announced an interruption', { from: formatClockTime(since), to: formatClockTime(Date.now()) })
```

- [ ] **Step 2: Log the map's mode, the sheet mount, and sheetTop on app-active (FIELD-2)**

In `src/map/MapScreen.tsx`, add the imports:

```ts
import { useEffect } from 'react'
import { AppState } from 'react-native'
import { logEvent } from '../log'
```

(`useEffect` joins the existing `useMemo, useRef` import from `'react'`.)

Log the mode whenever it changes:

```ts
useEffect(() => {
  logEvent('info', 'map', 'map mode', { mode })
}, [mode])
```

Log the sheet's reported top edge each time the app becomes active — the value whose being parked at the window height *is* FIELD-2:

```ts
// FIELD-2: the sheet is sometimes left at the window height after the app is reopened, which drives
// graphBottom negative. sheetTop is a shared value, so it is read here on the JS thread.
useEffect(() => {
  const subscription = AppState.addEventListener('change', (state) => {
    if (state !== 'active') return
    logEvent('info', 'map', 'app active', {
      mode,
      sheetTop: Math.round(sheetTop.value),
      rootHeight: Math.round(rootHeight.value),
      graphBottom: Math.round(graphBottom.value),
    })
  })
  return () => subscription.remove()
}, [mode, sheetTop, rootHeight, graphBottom])
```

And log the recording sheet's mount where `RecordingInfoSheet` is rendered in the tree — add to that branch, inside a small effect in `RecordingInfoSheet` itself if the branch is an expression rather than a block:

```ts
useEffect(() => {
  logEvent('info', 'map', 'recording sheet mounted')
}, [])
```

Read `src/recording/RecordingInfoSheet.tsx` and put the effect at the top of that component — mounting is the component's own fact, not `MapScreen`'s.

- [ ] **Step 3: Log the error boundary's catch**

In `src/components/ErrorBoundary.tsx`, add to the class — `componentDidCatch` is where React hands over a caught render error:

```ts
componentDidCatch(error: Error) {
  logEvent('error', 'error', 'error boundary caught a render error', { message: error.message, stack: error.stack })
}
```

Add the import:

```ts
import { logEvent } from '../log'
```

- [ ] **Step 4: Install a global handler for otherwise uncaught errors**

Create `src/log/installGlobalErrorHandler.ts`:

```ts
import type { ErrorUtils } from 'react-native'
import { logEvent } from './logEvent'

// React Native exposes ErrorUtils as a global value but exports only its type, so the global is read
// through that interface rather than left as any; the previous handler still runs, so the red screen
// and the native crash report are unchanged.
const globalErrorUtils = (globalThis as unknown as { ErrorUtils?: ErrorUtils }).ErrorUtils

export function installGlobalErrorHandler(): void {
  if (!globalErrorUtils) return
  const previous = globalErrorUtils.getGlobalHandler()
  globalErrorUtils.setGlobalHandler((error, isFatal) => {
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    logEvent('error', 'error', isFatal ? 'uncaught fatal error' : 'uncaught error', { message, stack })
    previous(error, isFatal)
  })
}
```

In `app/_layout.tsx`, call it once at module scope, beside the existing `import '../src/recording/locationTask'` side-effect import:

```ts
import { installGlobalErrorHandler } from '../src/log/installGlobalErrorHandler'

installGlobalErrorHandler()
```

**Deliberately not implemented here:** unhandled promise rejections. React Native only enables `promise/setimmediate/rejection-tracking` under `__DEV__` (`node_modules/react-native/Libraries/Promise.js`), so catching them in the release build the log exists to diagnose would mean this app reaching into a transitive dependency's internal path. The honest coverage is per-site: the `void …then()` chains ERR-3 names in `docs/reviews/2026-09-10-full-review.md` each get a real failure outcome under backlog item 6, and the "error" area logs them there. Record this in `docs/architecture/debug-log.md` in Task 10.

- [ ] **Step 5: Run the gate**

Run: `npm run verify`
Expected: exit 0. `react-hooks/exhaustive-deps` will inspect the new effects: the shared values (`sheetTop`, `rootHeight`, `graphBottom`) are stable references and listing them is correct, so no disable should be needed. If the rule still objects, fix the dependency list — do not disable it.

- [ ] **Step 6: Commit**

```bash
git add src/recording/useResumeRecording.ts src/recording/recordingController.ts src/map/MapScreen.tsx src/recording/RecordingInfoSheet.tsx src/components/ErrorBoundary.tsx src/log/installGlobalErrorHandler.ts app/_layout.tsx
git commit -m "feat(log): record the launch decision, the map's sheet geometry and uncaught errors"
```

---

### Task 9: The viewer, the Settings row, Share and Clear

**Files:**
- Create: `src/log/LogList.tsx`
- Create: `app/settings/log.tsx`
- Modify: `app/(tabs)/settings.tsx`

**Interfaces:**
- Consumes: `logRepository` (Task 2), `logExportText` + `deviceInfo` (Task 6), `LOG_MAX_ENTRIES` (Task 4), `ScreenHeader`, `useGoBackOrHome`, `AccentButton`.
- Produces: `LogList` (no props), the `/settings/log` route.

- [ ] **Step 1: Build the list**

Per `AGENTS.md`, this is rendering: it is device-verified, not unit-tested. Everything it decides was tested in Tasks 4 and 6.

Create `src/log/LogList.tsx`:

```tsx
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Alert, FlatList, Share, StyleSheet, Text, View } from 'react-native'
import { LogEntry, logRepository } from '../data/log'
import { AccentButton } from '../components/AccentButton'
import { useTheme } from '../theme/useTheme'
import { formatClockSeconds } from '../activities/format'
import { deviceInfo } from './deviceInfo'
import { logExportText } from './logExportText'
import { LOG_MAX_ENTRIES } from './retention'

export function LogList() {
  const c = useTheme()
  const [entries, setEntries] = useState<LogEntry[] | null>(null)

  const load = useCallback(() => {
    logRepository
      .list(LOG_MAX_ENTRIES)
      .then(setEntries)
      .catch(() => setEntries([]))
  }, [])

  useEffect(load, [load])

  const share = useCallback(() => {
    if (!entries) return
    void Share.share({ message: logExportText(entries, deviceInfo()) })
  }, [entries])

  const clear = useCallback(() => {
    Alert.alert('Clear the debug log?', 'Every entry is deleted. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          logRepository
            .clear()
            .then(() => setEntries([]))
            .catch(() => Alert.alert('Could not clear the log', 'Please try again.'))
        },
      },
    ])
  }, [])

  if (!entries) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={c.controlAccent} />
      </View>
    )
  }

  const levelColour = (level: LogEntry['level']) =>
    level === 'error' ? c.danger : level === 'warn' ? c.warning : c.onSurface

  return (
    <View style={styles.container}>
      <View style={styles.actions}>
        <AccentButton label="Share" onPress={share} />
        <AccentButton label="Clear" onPress={clear} />
      </View>
      <FlatList
        data={entries}
        keyExtractor={(entry) => String(entry.id)}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: c.onSurfaceVariant }]}>Nothing logged yet.</Text>
        }
        renderItem={({ item }) => (
          <View style={[styles.row, { borderColor: c.panelDivider }]}>
            <Text style={[styles.head, { color: levelColour(item.level) }]}>
              {formatClockSeconds(item.t)}  {item.area}  {item.message}
            </Text>
            {item.detail ? (
              <Text style={[styles.detail, { color: c.onSurfaceVariant }]}>{item.detail}</Text>
            ) : null}
          </View>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, padding: 12 },
  row: { paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1 },
  head: { fontSize: 13, fontWeight: '600' },
  detail: { fontSize: 12, marginTop: 2 },
  empty: { fontSize: 14, textAlign: 'center', padding: 24 },
})
```

`c.danger` and `c.warning` both exist in `src/theme/colors.ts` (light `#C62828`/`#E65100`, dark `#EF5350`/`#FFA726`), so the levels carry their colour with no new token — do not add one.

- [ ] **Step 2: Add the screen**

Create `app/settings/log.tsx`, following `app/settings/offline.tsx` exactly:

```tsx
import { View } from 'react-native'
import { useTheme } from '../../src/theme/useTheme'
import { LogList } from '../../src/log/LogList'
import { useGoBackOrHome } from '../../src/components/useGoBackOrHome'
import { ScreenHeader } from '../../src/components/ScreenHeader'

export default function DebugLogScreen() {
  const c = useTheme()
  const leave = useGoBackOrHome()
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScreenHeader title="Debug log" onBack={leave} />
      <LogList />
    </View>
  )
}
```

- [ ] **Step 3: Add the Settings row**

In `app/(tabs)/settings.tsx`, directly after the existing "Offline maps" `Pressable`, add its twin:

```tsx
<Pressable
  accessibilityLabel="Debug log"
  onPress={() => router.push('/settings/log')}
  style={[styles.row, { borderColor: c.panelDivider, marginTop: 8 }]}
>
  <Ionicons name="document-text-outline" size={20} color={c.onSurface} />
  <Text style={[styles.rowLabel, { color: c.onSurface }]}>Debug log</Text>
  <Ionicons name="chevron-forward" size={20} color={c.onSurfaceVariant} />
</Pressable>
```

Two navigation rows with identical structure is the point at which a shared row component is justified, and the owner ruled during execution that it is extracted **now**, not when a third row appears: `src/components/SettingsRow.tsx` holds the shape and both rows use it. The second instance is where duplication is born — waiting for a third is the rule `AGENTS.md` rejects.

- [ ] **Step 4: Run the gate**

Run: `npm run verify`
Expected: exit 0. The duplication gate may flag the two rows; if it does, extract `SettingsRow` in this task rather than adding a `DUPLICATION_EXEMPT` entry — the gate deciding is better than me guessing.

- [ ] **Step 5: Commit**

```bash
git add src/log/LogList.tsx app/settings/log.tsx 'app/(tabs)/settings.tsx'
git commit -m "feat(log): read, share and clear the debug log from settings"
```

---

### Task 10: Documentation

**Files:**
- Modify: `AGENTS.md`
- Create: `docs/architecture/debug-log.md`

- [ ] **Step 1: Tell the next agent the log exists**

Add this section to `AGENTS.md`, after "Architecture principles" and before "About comments":

```markdown
# The debug log

The app keeps its own log in SQLite, readable and shareable from Settings → Debug log. It is the
**first place to look** for a bug reported from the field. Write to it with
`logEvent(level, area, message, detail?)` from `src/log` — fire-and-forget, never awaited. It
**never records coordinates**: a position is logged as an accuracy and a distance, never a latitude
or longitude. See `docs/architecture/debug-log.md`.
```

- [ ] **Step 2: Record the design**

Create `docs/architecture/debug-log.md` covering: the `debug_log` table and its columns; the five areas and what each logs; retention (7 days / 5,000 entries, trimmed on launch); how to get the log off the phone (Settings → Debug log → Share); the no-coordinates rule and why; and a "Known limits" section stating that unhandled promise rejections are not captured (React Native enables rejection tracking only under `__DEV__`, so each known rejection site logs its own failure instead), that the log records what the JavaScript side did (a system kill leaves only silence after the last entry), and that the header's app version is `expoConfig.version` rather than the native build version.

- [ ] **Step 3: Run the gate and commit**

Run: `npm run verify`
Expected: exit 0.

```bash
git add AGENTS.md docs/architecture/debug-log.md
git commit -m "docs(log): record the debug log's table, areas, retention and limits"
```

---

## Device verification (hand-off to the user after Task 10)

A release build; the migration runs on launch. From the spec:

1. Record a short walk → Settings → Debug log shows the start, the segment, the fix batches and the stop.
2. Switch location off and on while recording → availability entries, with the recovery decision.
3. Share → the text arrives in Telegram, newest first, with the header.
4. Clear → the list empties.
5. Kill the app mid-recording and reopen → a launch entry with the action taken and the interruption range.
6. Reproduce the missing sheet → the map entries show the sheet's position when the app became active.

Scenario 6 is the one this whole slice was built for: if `sheetTop` on app-active equals the window height, FIELD-2 is confirmed as the sheet never reaching its snap position, and the fix belongs in the sheet's mount, not in `MapScreen`'s geometry.
