# Resume Location Gate & Segment-Bound Fixes — Design

**Status:** Approved design
**Branch:** `fix/resume-location-gate`
**Date:** 2026-09-17

## Goal

Pausing, switching location off, moving, then resuming must not draw a line from where the recording paused to
where it resumed. Resuming behaves like starting when location is unavailable.

## Diagnosis

- `applyResume` starts a new segment (`src/recording/session.ts:12-19`), and live and saved tracks are drawn per
  segment (`src/map/MapCanvas.tsx:61`, `app/activity/save.tsx:36`). Resume never joins two segments, so the line
  lies **inside the new segment**: its first point is the pause position.
- expo-location 57.0.11, `LocationTaskConsumer.didReceiveBroadcast` (`:83-92`): a broadcast carrying no location
  result — such as a location availability change — fetches `lastLocation` and delivers it to the task as a fix.
  After moving with location off, the last known location is the pause position. `src/recording/locationTask.ts`
  appends every fix it is given without checking when it was taken.
- `resumeRecording` commits a resume with location off and starts nothing, so capture begins on a later delivery.
- The `lastLocation` path is read in source; that the provider sends such a broadcast when location is re-enabled or
  a request is registered is not measured on the device. The rule in §3 is correct whatever delivers the stale fix.

## Existing shape

The closest existing shape is `startRecording`'s pre-turn gate (permission checks, `promptToEnableLocation`,
`'location-off'`) and `RecordButton`'s mapping of its results to alerts. Resume needs the same gate and the same
alerts, so both are extracted: `ensureCaptureReady` in the controller, used by start and resume, and one alert
helper used by `RecordButton` and `PausedControls`. The segment start time is new durable data; it follows the path
`currentSegment` already takes (schema column, `applyResume`/`applyRelaunch`, `markResumed`) rather than a new one.

## The change

### 1. One readiness gate

```ts
type CaptureReadiness = 'ready' | 'permission-denied' | 'location-off'
async function ensureCaptureReady(): Promise<CaptureReadiness>
```

Foreground access, then background access, then location available or the enable-location prompt accepted. It runs
**outside the chain**: a dialog that never answers must not hold pause, resume or discard behind it.

- **`startRecording`** keeps its order: the pre-turn active-session check, `ensureCaptureReady`, notification
  access, `whenAppActive`, then its turn. Behaviour is unchanged.
- **`resumeRecording(): Promise<ResumeResult>`**, with `ResumeResult = 'resumed' | 'permission-denied' |
  'location-off'`:
  1. Outside the chain: no paused session → `'resumed'` without prompting (only reachable by a race, since
     `PausedControls` renders while paused); otherwise `ensureCaptureReady`, and a refusal returns it with the
     session left paused.
  2. `whenAppActive`, since a dialog may just have closed.
  3. One turn: re-read the session; not paused → `'resumed'` (a concurrent resume won); otherwise `applyResume`,
     `markResumed`, `setSession`, `issueStreamIfAvailable`, `'resumed'`.

A resume can no longer commit with location off, so the sheet's "Location is off" after a resume only appears when
location goes off after the gate passed.

### 2. One set of alerts

`src/recording/captureAlerts.ts` maps a refusal and the action that was refused to an alert:

| Refusal | Title | Message |
|---|---|---|
| `permission-denied` | Location permission needed | To record your activity while the app is in the background, allow location access "All the time". |
| `location-off`, start | Location is off | Turn on location to start recording. |
| `location-off`, resume | Location is off | Turn on location to resume recording. |

`RecordButton` and `PausedControls` both call it.

### 3. A segment only accepts fixes taken after it began

- `RecordingSession.segmentStartedAt: number`, column `segment_started_at`. Migration `0006` adds it, backfilling
  existing rows from `started_at`, so a recording open during the upgrade stays valid.
- Set by `startSession(startedAt)` (to `startedAt`), `applyResume(session, now)` (to `now`) and
  `applyRelaunch(session, now)` (to `now`; the function gains `now`). `markResumed` persists it alongside
  `pausedMs` and `currentSegment`.
- `fixesInSegment(fixes, segmentStartedAt)` in `session.ts` keeps the fixes with `t >= segmentStartedAt`.
- `locationTask.ts` stores and shows only those fixes; a delivery left empty appends nothing.

## Rejected alternatives

**Gating resume only** (the first proposal). Switching location on and then resuming can still deliver the cached
pause position as the first fix of the new segment. **Filtering only, resume allowed with location off**: start and
resume would treat the same condition differently. **Dropping a fix far from the previous point**: a heuristic that
misjudges a real move or a GPS correction after a long gap, where the time a fix was taken is exact. **A new segment
when location goes off mid-recording**: the app cannot observe location going off while it is in the background.

## Consequences accepted

- **Fixes taken while paused but delivered after the resume are dropped** — at most one batch window (15 s).
- **A fix whose time trails the system clock is dropped.** The rule guards every segment, the first one
  included, and a fix's time comes from the location provider while the segment's start comes from the
  system clock. On a device whose provider timestamps lag, a recording loses its opening fixes, not just
  one at a resume. Android's location times are epoch-based and normally agree with the system clock.
- **Location switched off during a recording, without a pause, still bridges the unrecorded stretch with a line**:
  the request survives and capture continues in the same segment (unchanged from the 2026-09-12 design).
- **Resuming requires location**: the timer cannot be resumed while location is off.

## Test plan (Jest, written first)

`src/recording/__tests__/session.test.ts` — `applyResume` sets `segmentStartedAt` to `now`; `applyRelaunch(session,
now)` advances `currentSegment` and sets `segmentStartedAt`; `fixesInSegment` keeps a fix taken exactly at
`segmentStartedAt`, keeps a later one, drops an earlier one.

`src/recording/__tests__/recordingController.test.ts`:

- resume: foreground access denied → `'permission-denied'`, still paused, no `markResumed`, no start;
- resume: background access denied → the same;
- resume: location unavailable and prompt declined → `'location-off'`, still paused, no segment advanced;
- resume: prompt accepted → `'resumed'`, segment advanced, `segmentStartedAt` recorded, stream issued;
- resume: a discard issued while the resume's location prompt is pending completes without waiting for it;
- resume: no paused session → `'resumed'`, no prompt;
- start: its existing gate tests pass unchanged through `ensureCaptureReady`.

`src/recording/__tests__/locationTask.test.ts` — a fix taken before the segment began is neither stored nor added to
the live track; fixes taken after it are both.

`markResumed`'s new argument is covered by the controller tests above. The migration set has no tests in
this repo and gains none here; migration `0006` is checked on the device instead.

## Device verification

1. Pause, switch location off, walk 100 m, switch location on, resume, walk → two separate segments, no line across.
2. Pause, switch location off, resume → the enable-location dialog; decline → *"Location is off — Turn on location to
   resume recording."*, still paused.
3. Accept the dialog → resumes; walking draws a new segment starting where you are.
4. Paused and moved with location on, resume immediately → no line from the pause point.
5. Location off, Record → unchanged: the dialog, and declining shows the start alert.
