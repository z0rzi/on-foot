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

## 5. Elevation smoothing — RESOLVED 2026-09-08 (the original finding overstated it)

The finding as first written called this "two sources of truth" and claimed the gain/loss number and
the curve above it disagreed. **Tracing every consumer showed the split was already correct**, and
the owner has since confirmed the intended rule: *the smoothing setting is purely visual and must
never modify data.*

What is actually true, verified by tracing:

- The preference reaches only `ElevationGraph`, `useRouteColouring` and the settings screen. **No
  file under `src/data/` reads it.** Stored gain/loss comes solely from the fixed 150 m / 3 m
  pipeline in `data/geo/elevationFilter.ts`.
- The preference does not even reshape what is *drawn*: `buildBandAreas` / `buildBandLines` /
  `buildSlopeRuns` all take the **raw** profile for geometry and use the smoothed one only to decide
  where colour bands begin and end. The plotted curve, the elevation readout and the distances are
  raw throughout.

So the only thing the setting changes is slope-band boundaries — exactly its purpose — plus the
grade percentage in the scrub tooltip, where a smoothed value is the meaningful one to show.

The real defects were that this contract was **undocumented, unenforced and duplicated**:

- `slopeBands(smoothProfile(profile, smoothing), smoothing)` was computed independently in
  `ElevationGraph` and `useRouteColouring`. Now a single `displaySlopeBands(profile, smoothing)` in
  `elevation/slope.ts` — the one place the preference is applied, and where the contract is stated.
- Nothing stopped a future change from wiring the preference into the metrics pipeline. Now enforced
  by `src/architecture/importRules.ts`: no file under `src/data/` may import
  `settings/preferencesStore`. Mutation-checked — adding that import to `data/geo/metrics.ts` fails
  the suite.
- Both constants now name their counterpart, so neither reads as the only smoothing in the app.

The one-value-drives-two-parameters point stands but is deliberate and now stated: the preference
feeds both the averaging window and `minRunMeters` because both exist to stop the colour bands
fragmenting. It is one knob for one user-visible property — band busyness.

**Lesson for this document:** a finding written from reading two files in isolation can invent a
conflict that tracing disproves. Trace the consumers before calling something a defect.

## 6. Efficiency — RESOLVED 2026-09-08

- **`bandGeometry.ts`** — `bandSamples` rebuilt the full `bySegment` map from every profile sample
  **per band**, and `segmentAt` linear-scanned it, three times per band per render pass.
  **Resolved:** replaced by `samplesForBands(profile, bands)`, which builds the segment index once
  per pass and locates each band's sample range by binary search instead of a filter, so the per-band
  cost drops from O(samples) to O(log samples + output). It returns `{ band, samples }` pairs, so no
  caller reaches back into `bands[i]` by position.
- **`svg.ts` redundant passes** — the first attempt fixed the per-band cost but left the duplicate
  work this section had named: `ElevationGraph` calls the area builder and the line builder with
  identical arguments, so samples were resolved and projected twice to produce identical geometry,
  and the two builders had grown a verbatim-duplicated prelude. **Resolved** in a follow-up:
  `buildBandTops` does the resolve, project and short-band filter once, and `areaPaths` / `linePaths`
  are cheap string builds over those shared tops. `ElevationGraph` memoizes the tops.

  *Worth remembering:* the first pass optimised the inner loop and re-introduced a duplication one
  level up. Fixing a hot path is not a licence to stop reading the surrounding code.
- **`RecordingInfoSheet.tsx`** — `metricsForSegments(groupPointsBySegment(livePoints))` ran
  unmemoized while `useMovingStopwatch` re-rendered the sheet every second, re-measuring the whole
  track once per tick. **Resolved:** memoized on `livePoints`, which only changes when points arrive.

**Magnitude, honestly.** On a realistic 3000-sample trail with ~150 bands the original cost was on
the order of a million operations, on trail selection and smoothing changes — a cold path, not a
per-frame one. A real win, but not something that was visibly stalling the app.

**How the rewrite was verified.** The three existing unit tests (boundary interpolation, own-segment
regression, shared boundary) still pass, and two were added for band/result alignment and complete
inner-sample inclusion. Beyond that the new implementation was differentially tested against a
verbatim copy of the old one over 300 randomised multi-segment profiles with boundaries forced onto
exact sample distances — the case a binary-search off-by-one would break. Structure matched exactly.
The only numeric divergence was 1 ULP on `lat`/`lng` where a boundary coincides with a sample: the
old code reconstructed the value as `a + (b - a) * 1`, the new one returns the sample itself, so the
new result is the more accurate of the two. The differential harness was deleted after it passed —
it required keeping a copy of the dead implementation, which is not worth maintaining.

## 7. The persistence seam's cost is unenforced — RESOLVED 2026-09-08

`ActivityRow` (`src/data/activities/mapping.ts:8`) and `TrailRow` (`src/data/trails/mapping.ts:3`)
hand-mirror `src/data/db/schema.ts`, and the repositories cast blindly —
`rows[0] as ActivityRow` at `src/data/db/activitiesRepository.ts:22, 34, 67, 71` and
`src/data/db/trailsRepository.ts:10, 14`.

Keeping drizzle types out of the domain is the right call, but nothing links the two: add or rename a
column in `schema.ts` and TypeScript stays silent until runtime. Also `ActivityInsertValues`
(`mapping.ts:24`) is exactly `Omit<ActivityRow, 'id'>` written out longhand.

**Resolved by deletion.** The six `as XRow` casts were removed and nothing else was added: drizzle's
inferred select type was already structurally compatible with each hand-written `Row`, so the casts
were not bridging a gap — they were *suppressing* the check TypeScript performs anyway when a
drizzle row is passed to `rowToSummary(row: ActivityRow)`. With the casts gone, that call site is
the assertion. The seam is untouched: `mapping.ts` still imports nothing from drizzle; the
compatibility check happens inside `src/data/db/`, the one place allowed to see both types.

Mutation-tested: renaming `comments` to `notes` in `schema.ts`, and separately dropping `.notNull()`
from `name`, each fail `tsc` with an error pointing at the exact repository line. Before this change
both compiled clean and failed at runtime.

The insert direction needed nothing: `db.insert(t).values(x)` already type-checks `x` against
drizzle's insert model. `ActivityInsertValues`, `TrailInsertValues` and `RecordingPointInsertValues`
are now `Omit<XRow, 'id'>` rather than the same field lists restated — the derivations compile, which
is itself proof the copies were exact.

*Scope note:* this catches a column the domain reads being renamed, retyped or made nullable. It does
not flag a column *added* to the schema that no `Row` mentions — a wider drizzle row is still
assignable to a narrower `Row`. That is correct: `Row` is the domain's view of the table, not a
mirror of it, and an unread column is not a runtime hazard.

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
3. ~~**Resolve the smoothing double-truth** (§5)~~ — **done 2026-09-08**; the split was already
   correct, so the work was to document, deduplicate and enforce it. See §5.
4. **Move the four pure blocks out of `.tsx` and TDD them** (§2), and close the unjustified disable (§3).
5. ~~**Hoist the `bandSamples` index and memoize the live metrics** (§6)~~ — **done 2026-09-08**;
   ~~add the schema/row assertion (§7)~~ — **done 2026-09-08**, by removing the casts that hid it.
6. **Delete the dead exports and the placeholder UI** (§8).
7. **Add an `onControlAccent` theme token** and retire the `c.surface`-as-button-text convention (§9).
