# Codebase health check — 2026-09-07

A whole-codebase review (169 production files, ~9k lines), not tied to one feature. Written so a
later session can pick up any single item without re-deriving the analysis. Each finding carries
its file:line anchors and the principle from `AGENTS.md` it bears on.

**Baseline at time of writing:** `npm run verify` green — 42 suites / 339 tests, `tsc --noEmit`
clean, `expo lint` at 0 warnings / 0 errors. All three seams (`map-provider`, `persistence`, `net`)
hold: no forbidden import outside its `allow` prefix.

**Shape of the findings:** the architecture is sound; there is no rot in the seams or the store
design. Nearly everything below is one root cause — **the trail domain and the activity domain were
built in separate sessions, and the second copied the first instead of extracting the shared
shape.** Fixing §1 dissolves most of the rest.

---

## 1. Systematic duplication between the trail and activity domains — RESOLVED 2026-09-07

*Principle: "Respect existing patterns… If a pattern genuinely needs to change, change it
deliberately and everywhere — don't fork it."*

Cross-file copy-pairs:

| Trail side | Activity side | Actual difference |
|---|---|---|
| `src/map/useSelectedTrail.ts` | `src/map/useSelectedActivity.ts` | **Identical modulo the entity name** — the whole diff is 2 import lines |
| `src/trails/difficulty.ts` | `src/activities/effort.ts` | Enum members only |
| `src/trails/DifficultyBadge.tsx` | `src/activities/EffortBadge.tsx` | Nothing structural |
| `src/trails/DifficultySelector.tsx` | `src/activities/EffortSelector.tsx` | Loop variable named `d` vs `e` |
| `src/trails/TrailListItem.tsx` | `src/activities/ActivityListItem.tsx` | One extra button, one extra text row; `styles` identical |
| `src/trails/TrailForm.tsx` | `src/activities/ActivityForm.tsx` | Same skeleton; identical `content`/`label`/`input`/`multiline`/`save` styles |
| `app/(tabs)/trails.tsx` | `app/(tabs)/activities.tsx` | Same list-screen skeleton; identical `styles` |

Within single files:

- **`src/map/MapCanvas.tsx:72-98`** — the trail-fit and activity-fit effects are the same 13 lines
  twice. `PendingFit` (`src/store/mapStore.ts:156`) was *deliberately generalized* over `kind` so
  both frame identically; the consumer then un-generalized it.
- **`src/map/MapOverlays.tsx:42-72`** — the activity and trail branches repeat the entire
  `<TrailOverlay>` prop list to vary `color` plus three arrow props.
- **Three implementations of "metric tiles in a row"** — `src/map/MetricsGrid.tsx`,
  `src/trails/MetricsRow.tsx`, and an inline `Metric` at `src/activities/ActivityForm.tsx:125-132`.
  The latter two have byte-identical style objects.
- **The circular control button style is duplicated verbatim three times** —
  `src/components/ControlButton.tsx:26`, `src/map/RecordButton.tsx:143`,
  `src/map/PausedControls.tsx:63` (same size/radius/`elevation: 4`/`shadowOpacity: 0.2`).
  `ControlButton` exists to own exactly this.

Related token-naming drift: `effortColor` (`src/activities/effort.ts:12`) maps effort onto
`colors.difficultyEasy/Medium/Hard`, so the theme tokens now misname what they are used for.

**Resolved.** Every pair above is now single-sourced behind shared modules:

| New module | Replaces |
|---|---|
| `src/map/useSelectedEntity.ts` | the two identical selection hooks (now 4-line wrappers) |
| `src/components/enumField.ts` + `EnumBadge.tsx` + `EnumSelector.tsx` | `Difficulty{Badge,Selector}` + `Effort{Badge,Selector}` (deleted) |
| `src/components/EntityListItem.tsx` | the shared card in `Trail`/`ActivityListItem` (now thin wrappers) |
| `src/components/MetricsGrid.tsx` (moved from `src/map/`, gained `density`) | `src/map/MetricsGrid.tsx`, `src/trails/MetricsRow.tsx`, `ActivityForm`'s private `Metric` |
| `src/components/ListScreen.tsx` | the shared shell of `app/(tabs)/trails.tsx` + `activities.tsx` |
| `src/components/form.tsx` (`FormScreen`, `FormField`, `FormTextInput`, `SubmitButton`) | the shared skeleton + 6 identical style keys of `TrailForm` + `ActivityForm` |
| `controlSurfaceStyle` in `src/components/ControlButton.tsx` | the circular-button style duplicated in `ControlButton`/`RecordButton`/`PausedControls` |

`MapCanvas`'s two fit effects are merged into one keyed on a derived `fitSegments`, and
`MapOverlays` renders a single `<TrailOverlay>` with a conditional colour and arrow-prop spread.

Net: **-580 / +247 lines** across 25 files, 10 new modules. `npm run verify` green (43 suites,
344 tests — `src/activities/__tests__/effort.test.ts` is new; the effort enum previously had none).
Behaviour, styling, wording and accessibility labels were preserved throughout; the two `*Form` and
`*ListItem` components kept their exact external prop APIs, so no route file needed changing.

**Deliberately left alone:** `effortColor` still maps onto the `difficultyEasy/Medium/Hard` tokens
(the token-naming issue noted above) — renaming theme tokens is a separate, behaviour-changing
change. See §9, where the same hazard produced a shipped bug.

**Post-review correction:** `MetricsGrid` initially carried a `density: 'compact' | 'comfortable'`
prop to preserve the two source components' metrics exactly. Git history showed those differed only
by accidental drift (padding 12 vs 16, 1px of font size, written in different commits), and the
difference was imperceptible on device — so the prop was removed and all five call sites now share
the sheet metrics. Codifying accidental drift into a shared API is its own defect.

## 2. Pure logic hiding inside `.tsx`, where the TDD rule cannot reach

*Principle: "Pure logic is TDD'd; native rendering is device-verified."*

That line is drawn at the *file* boundary in practice: **48 components, 0 component tests**, and
`@testing-library/react-native` is a devDependency nothing imports. Correct for rendering — but real
decision logic ended up on the wrong side:

- `src/trails/TrailInfoSheet.tsx:92-106` — badge-state → menu-items mapping, 4 branches. Its sibling
  `src/map/offline/badge.ts` *is* extracted and tested. Same shape, opposite treatment.
- `src/map/offline/OfflineLayerChooser.tsx:76-112` — `toDownloadBytes` / `adds` / `removes` /
  `hasChanges`. This decides what gets downloaded and deleted, and it is untested.
- `src/map/MapScreen.tsx:53-69` — mode → which segments feed the elevation profile.
- `src/elevation/ElevationGraph.tsx:31-41` — `lineWidth` / `lineContrast` band mapping.

**Direction:** move each into a plain `.ts` module beside its feature and TDD it, following the
`offline/badge.ts` precedent. Then either use `@testing-library/react-native` or drop the dependency.

## 3. The one unjustified lint escape — and it hides a pattern already burned down

*Principle: "No new `eslint-disable` without a one-line justification"; and see
`docs/architecture/lint-debt.md`.*

`src/map/offline/OfflineLayerChooser.tsx:49-52`:

```ts
useEffect(() => {
  setSelected(new Set(downloadedIds.length ? downloadedIds : [currentStyleId]))
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [trail.id, downloadedIds.join(','), currentStyleId])
```

Three problems in four lines: the disable carries **no justification**; `downloadedIds.join(',')` is
a stringly-typed dep hack; and this is a set-state-in-effect — the exact pattern `lint-debt.md`
records as fixed in `useSelectedTrail`, `useSelectedActivity` and `ActivityInfoSheet` by deriving
during render. This one was missed.

Same file, minor: `renderBackdrop` (line 80) is not memoized, while the sibling
`src/map/LayersSheet.tsx:24` memoizes it — a forked pattern.

## 4. Recording start/resume have no rollback on partial failure — RESOLVED 2026-09-08

*Principle: "Fix the root cause, at the right layer."*

`src/recording/recordingController.ts:20-24`:

```ts
const sessionId = await activitiesRepository.startSession(startedAt)   // durable row written
useRecordingStore.getState().beginSession({ ... })                     // UI now says "recording"
await Location.startLocationUpdatesAsync(RECORDING_TASK, ...)          // if this throws…
```

If the third line throws, `RecordButton` (`src/map/RecordButton.tsx:48`) shows "Could not start
recording", but the DB row and the store session survive. The UI sits in recording phase, the
`recording_sessions` singleton index makes a retry return `'already-active'` (routing to the save
form), and nothing is being recorded. `resumeRecording` (lines 38-47) has the same shape:
`markResumed` + `setSession` commit before `startLocationUpdatesAsync` can fail.

**Resolved**, and the fix generalised: `pauseRecording` had the same defect in the other direction
(it stopped the stream *before* committing, so a failed `markPaused` left the durable session
claiming to record with nothing streaming).

One invariant now governs all three transitions, stated at the top of `recordingController.ts`:
**a durable session must never claim to be recording while nothing is streaming.**

- **pause** commits the pause, *then* stops the stream — and never fails for a stop error. A stream
  left running is harmless, because the background task drops fixes whenever `pausedAt` is set.
- **resume** starts the stream, *then* commits. A stream started before a failed commit is likewise
  ignored while the session is still paused.
- **start** has no safe state to fall back on, so it is the only one that compensates: it resets the
  store (which cannot fail) and best-effort deletes the session row. If that delete also fails, the
  surviving row still reaches the save screen via the existing `'already-active'` path, where the
  user can discard it.

So both orderings fail toward "paused with a stream running" — wasted battery, never lost data.

`startRecording` rethrows rather than adding a `StartResult` variant; `RecordButton`'s existing
catch already shows "Could not start recording", and it is now telling the truth.

**Verification:** `src/recording/__tests__/recordingController.test.ts` drives each transition
through its native failure — a path unreachable on a device. The four failure-path tests were
mutation-checked: all four fail against the pre-fix controller and pass against the fixed one.

## 5. Two sources of truth for elevation smoothing

- `src/data/geo/elevationFilter.ts:9-10` — fixed 150 m window / 3 m deadband, used by
  `computeMetrics`, which produces the gain/loss values **written to the DB at import time**.
- `src/settings/preferencesStore.ts:28` — user-selectable 0/25/50/100/200 m (default 50), used by
  `ElevationGraph` and `useRouteColouring`.

Consequence: in `TrailInfoSheet` the "Elev. Gain" tile and the curve directly above it come from
differently-smoothed series, and moving the settings slider changes the graph but never the number.

Related conflation: `src/elevation/useRouteColouring.ts:22` passes the same preference as both the
smoothing window *and* `minRunMeters` — two different physical quantities behind one slider.

**Direction:** decide whether stored metrics follow the preference (recompute on read) or the
preference is graph-only (and say so in one place). If `minRunMeters` should stay coupled, make that
explicit rather than incidental.

## 6. Efficiency

- **`src/elevation/bandGeometry.ts:34`** — `bandSamples` rebuilds the full `bySegment` map from every
  profile sample **per band**, and `segmentAt` linear-scans it. It is called three times per band per
  render pass (`buildBandAreas`, `buildBandLines` in `src/elevation/svg.ts`, and `buildSlopeRuns` in
  `src/elevation/mapSlope.ts`). O(3 × bands × samples) where one hoisted index makes it O(samples).
- **`src/recording/RecordingInfoSheet.tsx:35`** — `metricsForSegments(groupPointsBySegment(livePoints))`
  runs unmemoized on every render, and `useMovingStopwatch` forces a render every second. During a
  long recording that is a full haversine + smoothing pass over the whole track, once per second.

## 7. The persistence seam's cost is unenforced

`ActivityRow` (`src/data/activities/mapping.ts:8`) and `TrailRow` (`src/data/trails/mapping.ts:3`)
hand-mirror `src/data/db/schema.ts`, and the repositories cast blindly —
`rows[0] as ActivityRow` at `src/data/db/activitiesRepository.ts:22, 34, 67, 71` and
`src/data/db/trailsRepository.ts:10, 14`.

Keeping drizzle types out of the domain is the right call, but nothing links the two: add or rename a
column in `schema.ts` and TypeScript stays silent until runtime. Also `ActivityInsertValues`
(`mapping.ts:24`) is exactly `Omit<ActivityRow, 'id'>` written out longhand.

**Direction:** a compile-time assertion inside `src/data/db/` (the only place allowed to see drizzle
types) that the inferred row type is assignable to the hand-written one — the seam stays intact and
drift becomes a type error.

## 9. Found by device verification of the §1 refactor (2026-09-07)

Walking the §1 refactor on-device surfaced three bugs, none of them regressions — `MapScreen.tsx`,
`profile.ts` and `OfflineLayerChooser.tsx` were all untouched by that change.

- **Blank elevation graph pushed the map controls up — FIXED.** `buildElevationProfile` returned a
  profile as soon as *one* sample carried elevation. With a single sample `segmentRuns` iterates
  zero times, so every band, area and line is empty: the SVG draws nothing while `MapScreen` still
  reserves `GRAPH_HEIGHT` and lifts the controls. It fired on the first GPS fix when recording
  without a trail. Fixed at the source — a profile now requires ≥2 samples spanning a non-zero
  distance (which also covers recording while stationary), so every consumer is correct at once.
  Two regression tests added in `src/elevation/__tests__/profile.test.ts`.
- **Offline "Apply" button was black-on-blue in light theme — FIXED.** It used `c.controlsText`
  (`#000000` in light) on a `c.controlAccent` background; every other accent button uses `c.surface`.
- **Keyboard covered the description field on Android — FIXED.** `KeyboardAvoidingView` with
  `behavior={undefined}` (Expo's documented Android guidance) is inert under edge-to-edge, which is
  the default since SDK 54: the window no longer resizes for the IME, so there was nothing to
  scroll. Replaced with `react-native-keyboard-controller`'s `KeyboardAwareScrollView` in
  `src/components/form.tsx` — Expo's own recommended escalation. The dependency is confined to that
  one file; it is a UI helper, not a swappable engine, so it is not a seam.

**Theme-token naming is now a recurring hazard** (related to the `effortColor` note in §1). There is
no token for "text on an accent button": the three existing call sites spell it `c.surface`, which
is why a fourth reached for the plausible-sounding `c.controlsText` and shipped black-on-blue. An
`onControlAccent` token would make the role nameable and stop the next occurrence. Not done — it is
a theme change, not a bug fix.

## 8. Dead code and small snags

- `src/map/offline/operations.ts:5` — `packIdsForTrail` has **no production caller** but does have a
  passing test, so it reads as covered code. Delete both, or wire it into `offlineStore.removeForTrail`
  (which currently reimplements the same filter inline at `offlineStore.ts:107`).
- `src/data/db/client.ts:5` — `sqliteDatabase` is exported and never imported.
- `src/map/offline/OfflineMapsList.tsx:83-86` — a shipped "AREAS · LATER / ＋ Download a custom area"
  placeholder that does nothing when tapped.
- `src/recording/useResumeRecording.ts:14-17` — `.then(() => { /* comments only */ })`; `router` sits
  in the dep array but is unused.
- `src/theme/useTheme.ts:5` — `getColors(useColorScheme() === 'dark' ? 'dark' : null)` maps a value
  into a type that immediately re-tests it.
- `src/recording/recordingController.ts:49` — `stopToSave` does not stop anything; it marks the linked
  trail (pausing already stopped location updates). The name misleads.
- `src/store/mapStore.ts` runs ~22% comment lines. They are all genuine *why* comments and earn their
  place, but it is the one file drifting toward what `AGENTS.md` warns about — worth watching, not
  worth stripping.
- Native modules used in more than one place and not yet seams: `expo-location` (4 files) and
  `@react-native-async-storage/async-storage` (2 files) are already tracked as candidates in
  `docs/architecture/seams.md`. **`expo-file-system` is not** — it is used by
  `src/map/offline/diskSpace.ts` and `src/data/trails/gpx/readFile.ts`; add it to the candidates list.

---

## Suggested order

1. ~~**Extract the shared trail/activity kit** (§1)~~ — **done 2026-09-07**, see the table in §1.
2. ~~**Fix the recording rollback** (§4)~~ — **done 2026-09-08**, see §4.
3. **Resolve the smoothing double-truth** (§5) — a user-visible inconsistency, and a design decision
   that should be recorded once.
4. **Move the four pure blocks out of `.tsx` and TDD them** (§2), and close the unjustified disable (§3).
5. **Hoist the `bandSamples` index and memoize the live metrics** (§6); add the schema/row assertion (§7).
6. **Delete the dead exports and the placeholder UI** (§8).
7. **Add an `onControlAccent` theme token** and retire the `c.surface`-as-button-text convention (§9).
