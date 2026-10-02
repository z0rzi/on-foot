# Debug Log — Design

**Status:** Approved design
**Branch:** `feat/debug-log` (created after `fix/resume-location-gate` merges)
**Date:** 2026-09-18

## Goal

The app keeps its own record of what it did, so a bug noticed on a hike can be diagnosed afterwards without the
phone being plugged in and without catching the moment live. From now on, the log is the first place to look when
something is reported from the field. Its first consumer is FIELD-2 in `docs/reviews/2026-09-10-full-review.md`
§5.1: the recording sheet missing after leaving and reopening the app while following a trail.

## Existing shape

There is no logging in the app today — no `console.log` anywhere in `src/` or `app/` — so the writer, the export
and the viewer's content are new. Three existing shapes are reused rather than reinvented: **storage** follows the
persistence seam exactly as activities and trails do (a table in `src/data/db/schema.ts`, a generated migration, a
repository interface in `src/data/<domain>/repository.ts` with its drizzle implementation in `src/data/db/`);
the **screen** follows `app/settings/offline.tsx`, reached from a navigation row in `app/(tabs)/settings.tsx`, with
`ScreenHeader` for its header; the **Share control** is the existing `AccentButton`.

## The change

### 1. The table

`debug_log`, migration `0007`:

| column | type | meaning |
|---|---|---|
| `id` | integer, primary key | |
| `t` | integer, not null | when the entry was written (ms since epoch) |
| `level` | text, not null | `info`, `warn` or `error` |
| `area` | text, not null | `recording`, `capture`, `launch`, `map` or `error` |
| `message` | text, not null | one short human sentence |
| `detail` | text, nullable | compact JSON, or null |

An index on `t` serves both the newest-first viewer and the trim.

### 2. The writer — `src/log/`

```ts
export type LogLevel = 'info' | 'warn' | 'error'
export type LogArea = 'recording' | 'capture' | 'launch' | 'map' | 'error'

export function logEvent(level: LogLevel, area: LogArea, message: string, detail?: Record<string, unknown>): void
```

- **Fire and forget.** `logEvent` returns nothing, never throws, and no caller awaits it. A storage failure is
  dropped: a log that breaks the app would be worse than no log.
- **Ordered.** Writes are queued one after another, so entries keep the order in which they happened even when two
  events race.
- **Serialisation.** `detail` is stored as compact JSON; a value that cannot be serialised leaves `detail` null
  rather than throwing.
- **Never coordinates.** `fixBatchSummary`, in `src/log/`, summarises a batch of fixes and reports counts, times, accuracy and the
  distance from the previous point — never latitude or longitude. A test asserts the summary carries no
  coordinate.

### 3. What is logged

- **recording** — start, pause, resume, finish and discard with their results, including refusals
  (`location-off`, `permission-denied`); each new segment with the time it began.
- **capture** — a stream issued, refused or stopped; stream status changes; location availability changes; each
  batch of fixes (`fixBatchSummary`: how many arrived, the first and last time, how many were dropped as taken
  before the segment began, the best accuracy, the distance in whole metres from the previous stored point); each
  recovery trigger and what it decided.
- **launch** — a cold start with the app version, whether a recording row was found and the action taken; the
  interruption notice with the range it announced.
- **map** — map mode changes, the recording sheet being mounted, and the sheet's reported top position when the
  app becomes active. That last value is what FIELD-2 needs: the screenshot showed the sheet parked at the window
  height instead of its snap position.
- **error** — every failure that currently ends in an alert, the error boundary's catch, and a global handler for
  otherwise uncaught errors and unhandled promise rejections.

### 4. Retention

The last **7 days**, capped at the newest **5,000** entries, trimmed once per launch. A hike produces a few
hundred entries. `retentionCutoff(now)` is the pure part; the repository deletes by cutoff and by count.

### 5. The viewer

`app/settings/log.tsx`, reached from a "Debug log" row in Settings beside "Offline maps":

- Newest first, one row per entry: `HH:MM:SS`, area, message, and the detail below it when present; `warn` and
  `error` carry their level's colour.
- Two actions in the header: **Share** (`AccentButton`) and **Clear** (confirmed by an alert).

### 6. Sharing

`logExportText(entries, meta)`, in `src/log/`, builds the shared text: a header naming the app version, the phone model and the
Android version, then one line per entry, newest first. It is capped at 200,000 characters — a share intent that
exceeds the system's limit fails silently — and the cap ends with a line saying how many entries were left out.
React Native's built-in `Share.share({ message })` sends it; no new dependency.

## Rejected alternatives

**A text file through `expo-file-system`**: trimming means rewriting the file, and file access would first have to
become its own seam. **An in-memory buffer flushed periodically**: loses the seconds before a crash or a kill,
which are the moments the log exists to explain. **Logging to logcat only**: the buffer rotates within hours and
needs a cable. **Android's process-exit reasons**: valuable for FIELD-1 and deliberately out of this slice — it
needs a native module and a prebuild.

## Consequences accepted

- The log is always on in release builds: a few hundred small inserts per hike.
- Sharing hands the text to whatever app the user picks.
- With no coordinates, a bad fix shows up as an implausible distance, not as a place on a map.
- The log records what the JavaScript side did; a kill by the system leaves only the silence that follows the last
  entry.

## Test plan (Jest, written first)

- `logExportText` — newest first; the header carries version, model and OS; detail is rendered as compact JSON; the
  cap truncates and appends the omitted count.
- `retentionCutoff` — 7 days before the given instant.
- `fixBatchSummary` — counts, first and last time, dropped count, accuracy, whole-metre distance from the previous
  point; the result contains no latitude or longitude.
- `logEvent` — entries reach the repository in the order they were logged; a repository rejection is swallowed and
  the next entry is still written.
- The screen is device-verified, per `AGENTS.md`.

## Documentation

`AGENTS.md` gains a short section: the app keeps a debug log, write to it with `logEvent`, it is the first place to
look for a bug reported from the field, and it never records coordinates. `docs/architecture/debug-log.md` records
the table, the retention and how to get the log off the phone.

## Device verification

1. Record a short walk → Settings → Debug log shows the start, the segment, the fix batches and the stop.
2. Switch location off and on while recording → availability entries, with the recovery decision.
3. Share → the text arrives in Telegram, newest first, with the header.
4. Clear → the list empties.
5. Kill the app mid-recording and reopen → a launch entry with the action taken and the interruption range.
6. Reproduce the missing sheet → the map entries show the sheet's position when the app became active.
