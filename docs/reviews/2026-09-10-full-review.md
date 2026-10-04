# Full review — on-foot-rn — 2026-09-10

**Scope.** Whole codebase at commit `9833610` (branch `master`): `src/` (all areas), `app/` (routes),
`modules/share-intent` (reviewed through its TypeScript contract only; the Kotlin side is out of
scope), root configs (`package.json`, `tsconfig.json`, `eslint.config.js`, `app.config.ts`,
`babel.config.js`, `metro.config.js`, `.github/workflows/verify.yml`, `.husky/pre-push`, the
`expo-task-manager` patch). Excluded: `android/` (generated), `node_modules/`, the untracked
workspace files (`.serena/`, `run-app.sh`, `.claude/agents/`) — tooling noise, not product code.

**Progress.** Backlog items 1 (PERF-1, DUP-8), 2 (ERR-2, TEST-2) and 3 (ERR-1) are done — `085d4da`,
the `fix/gpx-no-route-guard` branch merged at `50785dc`, and `331e00b`; designs in
`docs/superpowers/specs/2026-09-10-onfoot-rn-selection-revalidation-design.md` and
`docs/superpowers/specs/2026-09-10-onfoot-rn-gpx-no-route-guard-design.md`. Everything below is
the report as written against `9833610`; resolved findings are marked in place.

**Method.** Every production `.ts`/`.tsx` file under `src/`, `app/` and `modules/share-intent` was
read in full (~9.8k lines incl. tests; 173 files). Consumers of every suspected dead export were
traced with `grep`; dependency usage was checked by import grep plus the installed packages'
`peerDependencies`; churn from `git log`. No gates were run (they belong to `npm run verify`); no
network. No `.codegraph/` index exists, so CodeGraph was not used.

**Previous report.** `docs/architecture/health-check-2026-09-07.md` (the project's health-check
series; every section there is marked resolved). This report lives in `docs/reviews/` per the
review convention; the health-check series remains the project's own close-out document.

---

## 1. Verdict

The codebase is in good health and visibly better than at the 2026-09-07 health check: the three
seams hold, the store design is coherent, pure decisions live in tested `.ts` modules, and the
four lint escapes are all justified and inventoried. The architecture does what `AGENTS.md`
promises. What matters most now is one **freshness-ownership gap**: the selected trail is
re-fetched from SQLite and the whole map/graph derivation is rebuilt every time a list tab is
focused (PERF-1), and the same profile-plus-banding derivation has three owners (DUP-2). The
second thing that matters is two **degraded-mode gaps** with no user-visible outcome: an empty or
non-GPX file becomes a saveable empty trail (ERR-2), and an orphaned background location stream is
never stopped on launch despite a comment saying it is (ERR-1). Everything else is small and cheap:
six template dependencies nobody imports, a README that still describes `create-expo-app`, and a
handful of renamed-copy shapes under the duplication gate's window. Trend since the previous
report: clearly improving; no regressions found.

## 2. Health dashboard

| Dimension | Status | Summary | Findings (must / should / minor) |
|---|---|---|---|
| Architecture & seams | 🟢 | Seams intact; one presentation leak into the data layer; a native module outside the scanner; one unjustified double cast at the map seam | 0 / 1 / 3 |
| Duplication & drift | 🟠 | Bounds computed twice; profile+banding derived three times; five copies of "load by id, spinner, back"; two theme tokens for one role | 0 / 2 / 6 |
| Dead code | 🟢 | No leftovers; a dead validator + three unread capability flags; two unread theme tokens | 0 / 0 / 4 |
| Error & failure handling | 🟠 | Empty GPX saves silently; orphaned location stream; four `void …then()` chains with no failure outcome | 0 / 3 / 2 |
| Test coverage of pure logic | 🟢 | Decision logic is tested and tests assert behaviour; `formatBytes` and the empty-GPX case are the gaps | 0 / 0 / 2 |
| Performance hot spots | 🟠 | Selected trail re-read and map/graph re-derived on every list-tab focus (plausible, unmeasured) | 0 / 1 / 2 |
| Dependency & config hygiene | 🟠 | Six unused dependencies; `@types/jest` ahead of `jest`; worktree/scratch dirs not ignored by tsc/eslint/git | 0 / 1 / 3 |
| Documentation freshness | 🟠 | README is the template; `app.config.ts` comment contradicts the shipped patch; two stale code comments | 0 / 1 / 4 |

## 3. Findings by dimension

### 3.1 Architecture & seams

**ARCH-1 — Presentation formatters live in the data layer** · `src/data/geo/metrics.ts:71-84`
(`formatDistance`, `formatElevation`, `formatMetricsSummary`) · `POST-WORK.md` §3 states
"presentation logic (formatters, view helpers) shouldn't live in the data layer", and the activity
side already keeps its formatters in `src/activities/format.ts`. Eight UI files plus
`activities/format.ts:2` import these from `data/geo`. · Why: the data layer becomes the home of UI
strings (`'no elevation data'`, `'—'`) and the two formatter modules are forked by layer rather than
by role. · Fix: move the three into a presentation module beside `activities/format.ts` (e.g.
`src/format/units.ts`, which could also host `map/offline/format.ts`'s `formatBytes`) and repoint the
nine imports. · **should-fix, S**.

**ARCH-2 — A native boundary outside the seam scanner** · `modules/share-intent/index.ts:11`
(`requireNativeModule('ShareIntent')`), consumed only by `src/trails/useIncomingShare.ts:3` ·
`src/architecture/sourceScan.ts:13` scans `src` and `app` only, so nothing stops a second
`requireNativeModule` call or a direct `expo-modules-core` import in `src/`. `AGENTS.md` asks that a
native-SDK wrapper be registered in `seams.ts` in the same change; this one predates the registry
and is not in `seams.md`'s candidates either. · Fix: either add `modules` to the scan roots and a
seam `{ tokens: ['expo-modules-core'], allow: ['modules/'] }`, or record in `seams.md` why an
app-owned module with a single consumer is exempt. · **minor, S**.

**ARCH-3 — Unjustified double cast at the map seam** · `src/map/providers/mapbox/adapter.tsx:52`
(`followUserMode as unknown as Mapbox.UserTrackingMode | undefined`) · The port's
`'normal' | 'compass' | 'course'` happens to equal rnmapbox's enum values today; the cast asserts
that rather than bridging it, so a rename in the SDK compiles and fails on device — the same class
of suppression the previous report removed at the persistence seam (§7). · Fix: an explicit
`Record<FollowUserMode, Mapbox.UserTrackingMode>` map in the adapter. · **minor, S**.

**ARCH-4 — `MapCapabilities.offline` promises a gate that does not exist** · `src/map/provider/types.ts:147-149`
("The capability flag `offline` gates whether it is meaningful for a given provider") · No consumer
reads `caps.offline`; `TrailInfoSheet` renders the offline menu and `OfflineMapsList` the registry
unconditionally. The MapLibre escape hatch `AGENTS.md` wants kept reachable would ship a broken
offline menu. · Fix: gate the offline entry points on `caps.offline` (one `if` in `TrailInfoSheet`
and `settings.tsx`), or delete the flag (see DEAD-1). · **minor, S**.

Clean: no forbidden imports outside `src/map/providers/`, `src/data/db/`, `src/net/`; the store
stays provider-agnostic (`StyleChoice` / `satellite` marker); no cycles by construction of the
import graph read; dependencies flow UI → store → repository interface → engine as declared.

### 3.2 Duplication & pattern drift

**DUP-1 — Bounding box computed twice, two `{ne, sw}` types** · `src/map/offline/bounds.ts:9-19` and
`src/map/geo.ts:10-21` share the same min/max loop; `boundsForTrail` is `boundsForPoints` plus a
margin expansion. `LngLatBounds` (`src/map/offline/types.ts:1`) and the inline return type at
`geo.ts:9` are the same shape declared twice. · Fix: `boundsForTrail = expand(boundsForPoints(points),
marginKm)`; one exported `LngLatBounds` in `map/geo.ts`. Both are tested, so the refactor is safe. ·
**should-fix, S**.

**DUP-2 — Profile and slope banding have three owners** · `src/map/MapScreen.tsx:53-56` builds
`activeProfile` from `profileSegmentsFor(...)`; `src/map/MapCanvas.tsx:69` →
`src/elevation/useRouteColouring.ts:20-22` rebuilds `buildElevationProfile` **and**
`displaySlopeBands` from the same `trail.geometry.segments`; `src/elevation/ElevationGraph.tsx:48`
runs `displaySlopeBands` a third time on the profile it receives. · Why: `POST-WORK.md` §3 requires
derived state to have one owner; the previous report deduplicated the *call* into
`displaySlopeBands` but left three callers computing the same result. Also PERF-2. · Fix: derive
`{ profile, banding }` once in `MapScreen` (or a `useDisplayBanding(profile)` hook keyed on
profile + smoothing) and pass `bands` to both the canvas colouring and the graph;
`useRouteColouring` then takes a profile, not segments. Device-verify graph and route colours. ·
**should-fix, M**.

**DUP-3 — "Load by id, key to the id, derive during render" exists five times** ·
`src/map/useSelectedEntity.ts:16-32`, `src/map/ActivityInfoSheet.tsx:31-46`,
`app/trail/[id]/edit.tsx:16-31`, `app/activity/save.tsx:26-45`, `app/trail/new.tsx:18-47` · The
health check extracted `useSelectedEntity` from two copies; the `ActivityInfoSheet` linked-trail
load is the same shape and the three route screens repeat the mount-load / `active` flag / spinner /
`router.back()` skeleton. None of the five has a failure outcome (ERR-3). · Fix: one
`useLoadedEntity(id, load)` returning `{ status: 'loading' | 'ready' | 'missing' | 'error', entity }`
plus a `LoadingScreen` component; the screens map `missing`/`error` to Alert + back. ·
**minor, S–M** (M when done together with ERR-3).

**DUP-4 — Verbatim twins under the gate's 8-line window** · Back header button
`src/trails/TrailForm.tsx:68-72` = `app/settings/offline.tsx:16-20`; centred spinner + identical
`styles.center` ×3 (`app/activity/save.tsx:47-53,77-79`, `app/trail/[id]/edit.tsx:33-39,56-58`,
`app/trail/new.tsx:49-55,72-74`); the `/trail/new?uri=` href built as a string in three places
(`src/trails/useIncomingShare.ts:12,21`, `app/+native-intent.ts:3`) and as an object in
`app/(tabs)/trails.tsx:73`. · Fix: `BackButton`, `LoadingScreen` (see DUP-3), `newTrailHref(uri,
name?)`. · **minor, S**.

**DUP-5 — Two theme tokens for one role** · `controlsText` (`src/theme/colors.ts:21,53,85`) has a
single consumer, the 2D/3D label at `src/map/MapControls.tsx:129`, while the four sibling icons in
the same cluster use `controlContent` (`MapControls.tsx:119,137,143,147`); the light values differ by
one shade (`#000000` vs `#1C1B1F`). The previous report (§9) identified `controlsText` as the
plausible-sounding token that shipped black-on-blue. · Fix: use `controlContent` at :129 and delete
`controlsText`. · **minor, S**.

**DUP-6 — The last renamed copy of the trail/activity pair** · `src/store/trailsStore.ts` and
`src/store/activitiesStore.ts` are the same load / mutate-then-reload store modulo names. At
25–30 lines each a `createRepositoryStore` factory buys little; record it, and extract only if a
third entity store appears. · **minor, accept**.

**DUP-7 — Filter-then-assert on `parsePackId`** · `src/map/offline/badge.ts:25,31,36`,
`src/map/offline/operations.ts:23`, `src/map/offline/OfflineLayerChooser.tsx:44` all filter packs by
`parsePackId(p.id)?.trailId === trailId` and then `parsePackId(p.id)!.styleId`. · Fix: a
`packsForTrail(packs, trailId): { pack, styleId }[]` helper removes five non-null assertions. ·
**minor, S**.

**DUP-8 — Two mechanisms keep the map selection fresh after a delete** ·
`app/(tabs)/activities.tsx:41-42` clears the selection by hand before deleting, while
`app/(tabs)/trails.tsx:37-48` relies on `useSelectedEntity.ts:24` (a load that returns `null`
clears the selection). Both paths are covered by the hook; the manual clear is the "freshness
convention repeated at each call site" that `POST-WORK.md` warns will drift. · Fix: drop the manual
clear, or — with PERF-1 — make the hook's revalidation key explicit so the guarantee is named in one
place. · **minor, S**. · **Done** (`085d4da`): the manual clear is gone; both tabs clear through the
hook.

### 3.3 Dead code

**DEAD-1 — `isValidCapabilities` and three unread capability flags** ·
`src/map/provider/types.ts:169-181` has no production consumer (only
`provider/__tests__/types.test.ts` and `providers/mapbox/__tests__/capabilities.test.ts`);
`requiresToken`, `supportsDataDrivenLayers`, `offline` (`types.ts:17-20`) are set by
`capabilities.ts:7-10` and read by nothing — only `supportsTerrain` (`MapCanvas.tsx:122`,
`MapControls.tsx:123`) and `styles` are consumed. · Fix: delete the validator and its tests; keep
`offline` only if ARCH-4 wires it; drop the other two until a second provider needs them. ·
**minor, S**.

**DEAD-2 — Unread theme tokens** · `primary` (`src/theme/colors.ts:4,36,68`) and `overlayScrim`
(`colors.ts:16,48,80`) have no consumer. · Fix: delete. · **minor, S**.

**DEAD-3 — `SizeEstimate.tileCount`** · `src/map/offline/types.ts:7`, produced at `estimate.ts:34`,
read only by `estimate.test.ts`; consumers use `.bytes` (`OfflineLayerChooser.tsx:76,142,144`). ·
Trivial; fold into DEAD-1's cleanup. · **minor, S**.

**DEAD-4 — `NetInfoState` re-export** · `src/net/netinfo.ts:4` is consumed only by its own test
(`netinfo.test.ts:1`). Harmless; the test can import the type from the package. · **minor, S**.

Clean: no `TODO`/`FIXME`/`console.*`, no commented-out code, no `@ts-ignore`; the four
`eslint-disable`s (`MapControls.tsx:70`, `RecordButton.tsx:69`, `parse.ts:36`,
`useMovingStopwatch.ts:20`) are justified and listed in `lint-debt.md`; `DUPLICATION_EXEMPT` is
empty; every icon in `src/assets/icons/` has a consumer; every `MapTokens` key is read. The
previous report's dead items (`packIdsForTrail`, `sqliteDatabase`, the "AREAS · LATER" placeholder,
the empty `.then`) are gone.

### 3.4 Error & failure handling

**ERR-1 — An orphaned location stream is never stopped on launch** ·
`src/recording/recordingController.ts:56-58` accepts a failed `stopLocationUpdatesAsync` with
"Left running; the next pause, discard or launch stops it" — but `resumeIfActive`
(`recordingController.ts:87-111`) only ever *starts* the task and does nothing when `action ===
'none'`; `app/activity/save.tsx:64-68` saves and resets the store without touching the stream. So
after a failed stop, or a save reached through the `'already-active'` route
(`RecordButton.tsx:46-47`) while a stream is running, the foreground service keeps running
("Recording your activity" notification, GPS on) with no session to feed, until the user happens to
pause a new recording. The background task itself is safe (`locationTask.ts:13-14` drops fixes with
no session), so this is battery and a misleading notification, not data loss. · Fix at the
controller, which already owns the "durable session vs stream" invariant: in `resumeIfActive`, when
there is no session and `hasStartedLocationUpdatesAsync`, stop the task; and route the save through
a controller `finishRecording(sessionId, input)` that stops the stream before `saveActivity`, so the
route file stops touching recording state directly. Add the two failure-path tests beside the
existing ones. · **should-fix, S** (device-verify the notification disappears). · **Done** (`331e00b`):
`resumeIfActive` stops an orphaned stream when no session is active, and the save goes through
`finishRecording`, which stops the stream before `saveActivity`.

**ERR-2 — An empty or non-GPX file becomes a saveable empty trail, silently** ·
`app/trail/new.tsx:31-37` never checks `parsed.segments.length`; `src/data/trails/gpx/parse.ts:69-75`
returns `segments: []` for a file with no points (and `fast-xml-parser` returns an object rather than
throwing for most non-XML text, so `?.gpx ?? {}` at :57 also yields `[]`). `metricsForSegments([])`
is `0 m / —`, the form renders, and "I'm done" persists a trail with no route. Downstream every
consumer degrades (`MapCanvas` `hasTrail` false, chooser "Cannot download"), so the user sees a trail
that does nothing. The `catch` at `new.tsx:38-43` also `router.back()`s on a read/parse error with no
message — a silent no-op for a malformed file. · Fix at the source: `parseGpx` throws (or returns a
tagged failure) when no route or track points exist; `new.tsx` shows one Alert ("This file has no
route") before going back, for both the empty and the throw case. Add the empty case to
`parse.test.ts` (TEST-2). · **should-fix, S**. · **Done** (`f03deb3`, `fe40716`, `b8e51a0`; merged
`50785dc`): `parseGpx` throws a `GpxError` carrying a `format` or `empty` reason, a segment needs two
points to count, and `new.tsx` tells the user which of the two happened instead of going back in
silence.

**ERR-3 — `void load().then(...)` chains with no failure outcome** ·
`src/map/useSelectedEntity.ts:22`, `src/map/ActivityInfoSheet.tsx:37`,
`app/trail/[id]/edit.tsx:21`, `app/activity/save.tsx:32` · `no-floating-promises` accepts `void`, so
a rejected repository call becomes an unhandled rejection: in `save.tsx` and `edit.tsx` the spinner
never exits (no retry, no back); in the two hooks the entity stays `null` with no signal. These are
local SQLite reads, so the probability is low, but the outcome when it happens is a stuck screen. ·
Fix: the shared hook from DUP-3 with an `error` status mapped to Alert + back. · **should-fix, M**
(S if done alone with a `.catch` per site, but that would fork the pattern a fifth time).

**ERR-4 — Silent no-ops** · `app/(tabs)/activities.tsx:23` returns without feedback when an
activity is tapped during a recording (deliberate rule, invisible to the user); `app/_layout.tsx:31`
`init(controller).catch(() => {})` leaves the offline registry empty with no indication, and
`OfflineMapsList` (`OfflineMapsList.tsx:24-28`) reloads trails on focus but never re-`init`s packs,
so after one failed init the settings list says "No offline maps yet" until the app restarts. · Fix:
`showToast('Finish the recording first')` for the first; for the second re-run `init` on focus of
`OfflineMapsList` (cheap) or keep a `loadFailed` flag the list can show. · **minor, S**.

**ERR-5 — Unhandled picker rejection** · `app/(tabs)/trails.tsx:65-74` `pickGpx` is an async
`onPress`; `DocumentPicker.getDocumentAsync` can reject (the attribute exemption in
`eslint.config.js` hides it). · Fix: try/catch with an Alert. · **minor, S**.

Clean and defensible: the recording transitions (rollback, pause-before-stop, resume-before-commit)
with their failure-path tests; `offlineStore.remove` best-effort semantics and orphan-subscription
teardown; `guardDownload` fail-open on probe errors; `useResumeRecording`'s documented catch;
`downloadPack`'s swallowed pre-delete; the root `ErrorBoundary`; `readFreeDiskBytes` normalising the
iOS nil.

### 3.5 Test coverage of pure logic

**TEST-1 — `formatBytes` untested** · `src/map/offline/format.ts:1-5` has three unit boundaries and
a clamp (`Math.max(1, …)`) and appears in three user-facing strings (`downloadConsent.ts:38,46`,
`OfflineMapsList.tsx:50-69`, `OfflineLayerChooser.tsx:142-160`); no test. Same for
`packDescriptor` (trivial) and `guardDownload`'s decision order (offline → disk → metered), which is
Alert-bound but could be lifted into a pure `downloadDecision(status, freeBytes, estimate)` and
tested the way `evaluateDownloadGate` is. · **minor, S**.

**TEST-2 — No test for a GPX with no points** · `src/data/trails/__tests__/parse.test.ts` covers
routes, tracks, namespaces, titles and a missing coordinate, but not the empty document / no-points
case that ERR-2 turns into a decision. · **minor, S** (write it first, then fix ERR-2). · **Done**
(`f03deb3`; merged `50785dc`): seven cases now assert the `reason`, not merely that it throws.

Clean: every decision helper the previous report moved out of `.tsx` (`menu.ts`, `plan.ts`,
`profileSource.ts`, `bandStyle.ts`) has its test; the sampled tests (`recordingController.test.ts`,
`offlineStore.test.ts`, `metrics.test.ts`, `trailsStore.test.ts`, `profileSource.test.ts`) assert
store state and controller effects through fakes at the native boundary, not mock call counts alone;
setup is small and local. 50 test files, ~390 test cases (43 suites / 344 tests at the previous
check). Residual pure logic still inside `.tsx`: the `rows` assembly in
`OfflineLayerChooser.tsx:63-73` (estimate / downloaded / actual bytes per style) — small, but it is
the input to `planOfflineChanges`, so a `chooserRows(styles, packs, trailId, bounds)` in `plan.ts`
would put the whole plan under test.

### 3.6 Performance hot spots

**PERF-1 — The selected trail is re-read and the map/graph re-derived on every list-tab focus** ·
`src/map/useSelectedEntity.ts:30` re-runs `load` whenever `revalidateOn` — the whole `trails` /
`activities` array — changes; `src/store/trailsStore.ts:14-16` always sets a new array, and it runs
on every focus of the Trails tab (`app/(tabs)/trails.tsx:25`), of the Offline maps screen
(`src/map/offline/OfflineMapsList.tsx:24-28`), and after every mutation. Each run reads the selected
trail's full geometry from SQLite (`JSON.parse` of the whole track), yields a new `Trail` reference,
and therefore invalidates every memo keyed on `trail.geometry.segments`: `MapScreen.activeProfile`
(`MapScreen.tsx:53-56`), `useRouteColouring` (`useRouteColouring.ts:18-27`: profile + banding + slope
runs), the three `MapOverlays` memos (`MapOverlays.tsx:34-36`), and hands Mapbox new `ShapeSource`
shapes (native re-upload). *Plausible, not measured*: for a 3000-sample trail this is the "million
operations" cold path the previous report quantified, now triggered by switching tabs. · Fix: one
owner of freshness — revalidate on a mutation version (a counter bumped in `addTrail` /
`updateTrail` / `removeTrail`) instead of the list reference, and/or have `loadTrails` keep the
previous array when the summaries are unchanged. Keeps the existing `clearSelection`-on-missing
behaviour. · **should-fix, S**. · **Done** (`085d4da`): both stores carry a `version` bumped only
by a mutation, and the selection hooks subscribe to it. The "keep the previous array when the
summaries are unchanged" half was rejected as unsound — `TrailUpdate` writes `description`, which is
not a `TrailSummary` field, so a description-only edit would compare equal and leave the map sheet
stale.

**PERF-2 — Triple profile/banding derivation** · see DUP-2 (`MapScreen.tsx:53-56`,
`useRouteColouring.ts:20-22`, `ElevationGraph.tsx:48`). Same cost class as PERF-1, on selection and
on every smoothing change. · **minor, M** (resolved by DUP-2).

**PERF-3 — Progress ticks re-render the trail sheet** · `src/map/offline/offlineStore.ts:27-28`
spreads `progress` on every tick; `TrailInfoSheet.tsx:42` subscribes to the whole map and recomputes
`offlineStateForTrail` each time. Bounded by the SDK's tick rate; noted only. · **minor, none**.

Clean: the previous report's hot paths stay fixed (`samplesForBands` index, shared `buildBandTops`,
memoized live metrics); gesture objects are memoized with honest deps; store selectors are narrow;
`pointCount` avoids the flattened copy.

### 3.7 Dependency & config hygiene

**DEP-1 — Six declared dependencies with no import, plugin or peer requirement** ·
`package.json`: `expo-device`, `expo-image`, `expo-web-browser`, `@expo/ui`, `expo-glass-effect`,
`expo-symbols` (the last three are already dependencies of `expo-router` itself). Checked and
*kept*: `expo-constants`, `expo-linking`, `react-dom`, `react-native-web`, `react-native-screens`
(peers of `expo-router`), `expo-font` (peer of `@expo/vector-icons`), `react-native-worklets` (peer of
`react-native-reanimated`), `expo-splash-screen` (config plugin, `app.config.ts:64`),
`expo-system-ui` (backs `userInterfaceStyle` on Android). · Fix: `npm uninstall` the six; confirm
with `npx expo export --platform android`. `/deps-check` should own this list. · **should-fix, S**. ·
**Done** (`4c41b17`): all six uninstalled; `npx expo export --platform android` exits 0 afterwards, so
no config plugin or autolink needed them. The debug log's export header deliberately reads the phone
model from React Native's `Platform.constants` rather than `expo-device`, to keep this prune available.

**DEP-2 — `@types/jest ^30` ahead of `jest ^29.7`** · `package.json` devDependencies · Type
surface newer than the runtime; harmless today, confusing when a v30-only matcher type-checks and
fails. · Fix: pin `@types/jest` to `^29`, or move to jest 30 when `jest-expo` does. · **minor, S**. ·
**Done** (`4c41b17`): pinned to `^29.5.14`.

**DEP-3 — Gate scope drift for worktrees** · `package.json` jest `testPathIgnorePatterns` excludes
`/.claude/worktrees/`, but `tsconfig.json:14-16` (`**/*.ts`, `**/*.tsx`) and the `ignores` block of
`eslint.config.js` do not; `.claude/worktrees/` exists (empty today). A checked-out worktree there
would be type-checked and linted a second time by `npm run verify` from the root. · Fix: add
`.claude/**` to `tsconfig` `exclude` and to the eslint `ignores`. · **minor, S**. · **Done**
(`4c41b17`): `.claude/**` and `.superpowers/**` excluded in both, so all three gates now agree on scope.

**DEP-4 — Workspace files not ignored** · `.serena/` and `run-app.sh` (a LAN IP in a dev-client
launch script) are untracked and not in `.gitignore`, so they pollute `git status` in every session
and risk an accidental `git add .`. · Fix: add both to `.gitignore`. · **minor, S**. · **Done**
(`4c41b17`). `.claude/agents/` is deliberately **not** ignored: the tracked `.claude/commands/retro-quality.md`
dispatches the agent defined there, so that definition belongs in git rather than in `.gitignore`.

Clean: `.env` is untracked and gitignored (enforced by `secrets.test.ts`); CI and the pre-push hook
both run exactly `npm run verify`; CI writes a placeholder `.env` for the babel transform; the
`expo-task-manager` patch is documented in the record-activity spec and applied by `postinstall`;
`babel`/`metro` agree on the `.sql` inline import; `tsconfig` `paths` `@/*` matches
`importGraph.ts`'s alias resolution.

### 3.8 Documentation freshness

**DOC-1 — `README.md` is the untouched `create-expo-app` template** · It documents
`npm run reset-project` (no such script in `package.json`), an `app-example` directory, and none of
the project's real setup: the `.env` keys `MAPBOX_ACCESS_TOKEN` / `MAPBOX_DOWNLOAD_TOKEN`
(`env.d.ts`, `app.config.ts:70`), `npx expo prebuild`, `npm run verify`, the seams. `tasks.md` lists
"Add README.md", so the owner knows; it is still the first document a newcomer reads. ·
**should-fix, S**. · **Done** (`ec9f703`): rewritten around the real setup — the two Mapbox tokens and
why a dev build is required, `prebuild`, the gate and what `jest` enforces beyond unit tests, the
directory map, and migration generation.

**DOC-2 — `app.config.ts` justifies a permission with behaviour the patch removed** ·
`app.config.ts:15-17`: "expo-task-manager delivers background location batches via a persisted
JobScheduler job (survives reboot), which the OS only allows with RECEIVE_BOOT_COMPLETED". The patch
`patches/expo-task-manager+57.0.12.patch` sets `setPersisted(false)` precisely so the job is *not*
persisted; the spec (`docs/superpowers/specs/2026-08-22-onfoot-rn-record-activity-design.md:309-318`)
records the permission as "belt-and-suspenders". The comment states the opposite of what ships
(`git log`: permission added in `43bd5c0`, patch in `70f6284`, comment never revisited). · Fix:
rewrite the comment to match the spec, or drop the permission after a device check on the OEMs the
spec names. · **minor, S**. · **Already fixed** (`dd7ffff`, the location-seam change): the comment now
says the receiver restores registered tasks after a reboot or app update, with no claim about a
persisted job. The permission itself still ships.

**DOC-3 — Stale adapter comment** · `src/map/providers/mapbox/adapter.tsx:30-33` "The one
imperative affordance is resetNorth" — `fitBounds` has been the second one since the recenter
feature; the port (`types.ts:99-116`) already describes both. · **minor, S**. · **Done** (`ec9f703`): the comment now names both
affordances and points at the port.

**DOC-4 — Small drifts in the architecture docs** · `docs/architecture/lint-debt.md` lists
`react-hooks/refs` **and** `react-hooks/immutability` for `MapControls.tsx`; the file disables only
`react-hooks/refs` (`MapControls.tsx:70`) — `RecordButton.tsx:69` is the one with both.
`docs/architecture/seams.md:23` says "Docs do not enumerate seams" and then enumerates them at :41;
say the table mirrors `SEAMS`. · **minor, S**. · **Done** (`ec9f703`): `lint-debt.md` now
attributes `immutability` to `RecordButton` only and names each disable's subject; `seams.md` says
`SEAMS` is the single source of truth and the table mirrors it. Also corrected `lint-debt.md`'s list of
facts-without-escape, which omitted the duplication and import-rule gates.

**DOC-5 — The `offline` capability comment** · see ARCH-4 (`types.ts:147-149` describes a gate
that nothing implements). · **minor, S**.

Clean: `AGENTS.md` and `POST-WORK.md` match the gates (`verify` = `tsc` + `jest` incl. seams /
secrets / cycles / duplication / import rules + `expo lint`); `seams.md`'s candidate list matches the
code exactly (`expo-location` in the four files named, AsyncStorage in two, `expo-file-system` in
two); the previous report's close-out statements verified true (row casts gone, `useResumeRecording`
cleaned, `onControlAccent` at all four text-on-accent sites, `intensity*` tokens); the barrel-vs-leaf
import rule in `POST-WORK.md` is followed (only the stores and the two selection hooks import the
`data/*` barrels).

## 4. Known debt inventory

| Debt | Count / where | Governing rule |
|---|---|---|
| ~~`expo-location` used outside a seam~~ | **resolved** (`dd7ffff`): zero files. The only remaining mentions are the `SEAMS` entry itself and a test fixture string; `location` is now an enforced seam | `seams.ts` — enforced |
| `@react-native-async-storage/async-storage` outside a seam | 2 files: `src/store/mapStore.ts`, `src/settings/preferencesStore.ts` | same |
| `expo-file-system` outside a seam | 2 files: `src/data/trails/gpx/readFile.ts`, `src/map/offline/diskSpace.ts` | same (two unrelated uses; "possibly two thin wrappers") |
| Dead column `recording_sessions.ended_at` | `src/data/db/schema.ts:40`; migration `0004` already nulls it | health-check §8 recorded-not-done (needs a migration) |
| Justified lint escapes | 4 `eslint-disable`s, one of which is the `parse.ts` `any` block (`RecordButton`, `MapControls`, `parse.ts`, `useMovingStopwatch`) | `lint-debt.md` "Standing inline exceptions" |
| Comment density in `mapStore.ts` | 60 of 275 lines (22%), all *why* comments | health-check §8 "worth watching" |
| `## Existing shape` spec section | 5 of 26 specs carry it (was 0 of 25; every spec written since the 2026-09-08 rule has one, including the debug log's) | `AGENTS.md`; applies to new specs only — baseline to watch |
| Legacy geometry shape `{ points }` | `src/data/trails/mapping.ts:22-28`, `src/data/activities/mapping.ts:57-62` (tested) | backward compatibility for pre-segment rows; remove with a data migration |
| GPX waypoints parsed and persisted, never rendered | `src/data/trails/types.ts:10`, `gpx/parse.ts:59` | `tasks.md` feature "Add waypoints" |
| Android-only surfaces | `src/components/toast.ts` (no-op elsewhere), `modules/share-intent` (`platforms: ["android"]`) | the app's declared target; documented inline |
| Renamed-copy store pair | `trailsStore.ts` / `activitiesStore.ts` (DUP-6) | accept until a third entity store appears |

## 5. Refactor backlog — top 10

| # | Item | Resolves | Benefit | Cost | Regression risk | Recommendation |
|---|---|---|---|---|---|---|
| 1 | ~~Revalidate the selected entity on a mutation version, not the list reference~~ | PERF-1, DUP-8 | High: stops a full DB read + map/graph rebuild on every tab switch; names the one owner of freshness | S | Low (store tests; behaviour on delete unchanged) | **done** — `085d4da` |
| 2 | ~~`parseGpx` rejects a file with no points; `new.tsx` shows one Alert for empty/invalid~~ | ERR-2, TEST-2 | High: removes a silent path to a useless persisted trail | S | Low | **done** — merged `50785dc` |
| 3 | ~~`resumeIfActive` stops an orphaned stream; save goes through a controller `finishRecording`~~ | ERR-1 | Medium-high: battery + misleading notification; controller keeps its invariant | S | Low-medium (device-verify) | **done** — `331e00b` |
| 4 | ~~Prune the six unused deps; pin `@types/jest`; ignore `.claude/`, `.serena/`, `run-app.sh`~~ | DEP-1..4 | Medium: smaller install, honest `verify` scope, clean `git status` | S | Low (bundle check) | **done** — `4c41b17` |
| 5 | ~~Doc refresh: README, `app.config.ts` permission comment, adapter comment, lint-debt table~~ | DOC-1..4 | Medium: first-contact docs stop lying; no code risk | S | None | **done** — `ec9f703` (DOC-2 had already been fixed in `dd7ffff`) |
| 6 | `useLoadedEntity` + `LoadingScreen` with an error outcome; `BackButton`; `newTrailHref` | DUP-3, DUP-4, ERR-3 | High: five copies → one, and every load gets a visible failure path | M | Low-medium | next |
| 7 | One owner for profile + slope banding (derive once, pass bands down) | DUP-2, PERF-2 | Medium: three derivations → one; makes the smoothing contract structural | M | Medium (device-verify graph + route colours) | next |
| 8 | Move `format*` out of `data/geo` into a presentation module (with `formatBytes`) | ARCH-1 | Medium: layering matches `POST-WORK.md`; one home for units | S | Low | next |
| 9 | `boundsForTrail` = `boundsForPoints` + margin; one `LngLatBounds` | DUP-1 | Medium | S | Low (both tested) | next |
| 10 | Retire `controlsText`/`primary`/`overlayScrim`; delete `isValidCapabilities`; gate on or drop `caps.offline`; bridge `followUserMode` explicitly | DUP-5, DEAD-1..3, ARCH-3, ARCH-4 | Low-medium: fewer traps for the next token/provider change | S | Low | later |

**Top three, in one sentence each.** (1) The revalidation key is the single change with the best
ratio: a few lines in `useSelectedEntity`/`trailsStore` remove a whole-track re-read and re-render
from every tab switch and make freshness ownership explicit. (2) The empty-GPX guard is the only
finding that lets the user persist something broken with no message, and it is a five-line fix plus
one test. (3) The orphaned-stream fix makes the controller's own comment true and closes the last
gap in the "durable session vs stream" invariant the previous report established.

### 5.1 Field findings — recording stream health device pass (2026-09-17)

Recorded after the `fix/recording-stream-health` device checklist passed; none traces to that
change. Evidence: `adb shell dumpsys activity exit-info com.zorzi.onfootrn`, dropbox crash
entries, and device experiments (OnePlus DN2103, Android 13, release build).

**FIELD-1 — The system kills the app in the background, sometimes for excessive CPU** · Since the
2026-09-16 14:26 install, every system kill happened at importance 300 or 400 — never with the
recording's foreground service up — and three were `EXCESSIVE CPU USAGE` while cached: 6–17 s of CPU
per 5 min against a 2% limit, at up to 384 MB. The "Recording interrupted" toast reports these deaths
truthfully. Open: what burns CPU while the app is cached with no recording, and whether any kill fell
during a recording that had lost its foreground service. · **should-fix, investigate**.
· **Data, 2026-10-02 → 10-04** (`adb shell dumpsys activity exit-info com.zorzi.onfootrn`): one
`EXCESSIVE CPU USAGE` kill in the window, at 2026-10-02 16:46:30 — `excessive cpu 11750 during 300152
dur=1120074 limit=2`, importance 400 (cached), pss 338 MB / rss 268 MB. That is 11.75 s of CPU in 300 s
≈ **3.9 % against a 2 % cap**, in a process that had been alive ~18.7 min. **The stronger lead is
memory, not CPU**: at the 17:57:22 permission kill the same day the app was at importance 125 — a
foreground service, recording — holding **pss 495 MB / rss 601 MB**. Against that, every kill across
10-03 and 10-04 is routine housekeeping at importance 400 (`TOO MANY EMPTY PROCS` and generic system
kills) with pss 10–44 MB and **no excessive-CPU kill at all**. So the pathology tracks what a recording
session retains, not idle caching — "what burns CPU while cached with no recording" may be the wrong
question; ask instead what a recording holds on to once it ends. The finding's second open question is
still open: no kill in this window fell during a recording that had lost its foreground service.

**FIELD-2 — The recording sheet is sometimes missing after reopening while following a trail** · The
sheet stays at `@gorhom/bottom-sheet`'s initial position (the window height), so `MapScreen`'s
`graphBottom` goes negative: the floating graph sits under the tab bar and the controls drop to the
bottom. Only a restart recovers, because a recording keeps `mode === 'recording'` and nothing remounts
the sheet. Not reproduced by swipe-away, nor by a relaunch after a kill. Candidates: the sheet's content
height changing during its mount animation, with dynamic sizing on by default in 5.2.14; or the trail
sheet being swapped for the recording sheet on a warm runtime after a process death, both writing
`sheetTop`. · Next: diagnostics logging sheet mounts, map-mode swaps and the sheet position when the
app becomes active. · **should-fix, S (diagnostics) then fix**. · **Diagnostics shipped** (`0f10e56`):
the debug log records the sheet's mount, every map-mode transition, and `sheetTop`/`rootHeight`/
`graphBottom`/`windowHeight` each time the app becomes active (`src/map/useSheetGeometryLog.ts`), so the
next reproduction is readable from Settings → Debug log. Note that the sample is taken once, at the
`'active'` transition, and none is taken on a cold start: one healthy reading does not refute this
finding. The fix itself is still open.
· **Cause found and fixed** (device log of 2026-10-02 17:57): `MapScreen` rendered **three** `BottomSheet`
instances — one per mode — all writing the same `sheetTop` shared value. A cold start that resumes a
recording mounts the trail sheet and swaps it for the recording sheet in the same tick: the outgoing
sheet left `736` (its snap point) in `sheetTop` while the incoming one never reached its own, so the
log read healthy while nothing was on screen, and only a restart recovered. The two runs that worked
had left 14 s and 22 s between the trail sheet mounting and the swap; the broken one had under a
second. Fixed by hoisting a single `MapInfoSheet` into `MapScreen` whose content switches by mode, so
there is one sheet instance and one writer; `enableDynamicSizing` is off (explicit snap points are the
contract), `graphBottom` now treats `sheetTop >= rootHeight` as "no edge yet" so the symptom cannot
recur, and the sheet logs each snap it settles on. **Needs a device pass**: record, kill the app,
reopen, and confirm the recording sheet appears.

**FIELD-3 — The interruption toast is hidden, and its range overstates the gap** · It fires while the
splash screen still covers the map, and its start is the last stored point, so a stationary user is
shown minutes of interruption before the actual death (observed `14:45–14:49` for a kill at 14:49).
· **minor, S**.

**FIELD-4 — expo-location crashes on a location delivery after the permission is revoked** ·
`SecurityException` wrapped in `RuntimeExecutionException` at `LocationTaskConsumer.kt:89`: for a
broadcast carrying no location result, `task.result` is read inside the `lastLocation` completion
listener, which runs outside the surrounding `try`. A delivery arriving just after the revoke kills the
process. Fix in a `patch-package` patch beside the existing `expo-task-manager` one. · **minor, S**. ·
**Done** (`patches/expo-location+57.0.11.patch`): the listener now checks `task.isSuccessful` and logs
the failure instead of reading `task.result`, which rethrows the task's `SecurityException` wrapped in a
`RuntimeExecutionException` on the callback thread. The outer `try` stays, for the throw the
`lastLocation` getter can still raise synchronously. Verified the patch reverses exactly against
upstream and re-applies through `postinstall` from clean; the crash path itself is **device-verified
only** — Jest cannot reach native code. Both patches are now documented in
`docs/architecture/native-patches.md`.
· **Diagnosis confirmed, fix still unverified** (device, 2026-10-02 17:57:23): revoking the permission
mid-recording killed the process (`reason=8 PERMISSION CHANGE`); Android restarted it for the foreground
service, and that process died 560 ms later with `reason=4 APP CRASH(EXCEPTION)` —
`RuntimeExecutionException` caused by `SecurityException: uid 10340 does not have any of
[ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION]`, thrown from `zzw.getResult` at
`LocationTaskConsumer.didReceiveBroadcast$lambda$2(LocationTaskConsumer.kt:89)`. That is exactly the
line and mechanism this finding names, so the diagnosis is right. **But that binary did not contain the
patch**: line 89 is a comment in the patched source and `task.result` moved to line 97, so the trace is
against upstream. Why the build lacked it was not established. The patch therefore remains **untested on
device** — re-run the revoke-mid-recording repro on a build made after `c3d627b` and confirm no
`data_app_crash` entry follows. Note also that the crash process had `pss=0.00` and died before the JS
side started, which is why the debug log holds no trace of it: as `docs/architecture/debug-log.md`
records, a native death leaves only the silence after the last entry.

**FIELD-5 — A crash in a relaunched recording process can hang instead of dying** · After
`am crash`, crash handling started (`FATAL EXCEPTION: main`) but the main thread stayed blocked for
minutes while the foreground service kept the process alive and its notification up. Seen once, on a
process relaunched after an earlier crash; unconfirmed for real crashes. · **investigate**.

## 6. Continuity with the previous report

`docs/architecture/health-check-2026-09-07.md` — every section verified against the current tree.

| ID | Title | Status | Note |
|---|---|---|---|
| §1 | Systematic trail/activity duplication | resolved | `EntityListItem`, `EnumBadge/Selector`, `MetricsGrid`, `ListScreen`, `form.tsx`, `controlSurfaceStyle`, `useSelectedEntity` all present and used; residual renamed pair is the two stores (DUP-6, accepted) |
| §2 | Pure logic hiding inside `.tsx` | resolved | `menu.ts`, `plan.ts`, `profileSource.ts`, `bandStyle.ts` exist with tests; `@testing-library/react-native` removed (`a8e4793`) |
| §3 | The one unjustified lint escape | resolved | `OfflineLayerChooser.tsx` has no disable; ticks derived by `seedKey` (:50-52); `renderBackdrop` memoized (:81) |
| §4 | Recording start/resume rollback | resolved | controller invariant + four failure-path tests present; adjacent new gap ERR-1 (orphaned stream on launch) |
| §5 | Elevation smoothing double truth | resolved | `displaySlopeBands` is the single application point; `IMPORT_RULES` bans the preference from `src/data/`; new adjacent finding DUP-2 (three callers) |
| §6 | Efficiency (`bandSamples`, svg passes, live metrics) | resolved | `samplesForBands`, `buildBandTops`, memoized metrics all in place; new adjacent finding PERF-1 |
| §7 | Persistence seam row casts | resolved | no `as XRow` anywhere; `Insert` types are `Omit<Row,'id'>` |
| §8 | Dead code and small snags | resolved (one recorded-not-done) | `packIdsForTrail`, `sqliteDatabase`, placeholder UI, empty `.then` all gone; `ended_at` still dead (§4 inventory); `expo-file-system` now in `seams.md` candidates |
| §9 | Device bugs + theme-token naming | resolved | ≥2-sample profile rule (`profile.ts:29`), `KeyboardAwareScrollView`, `onControlAccent` at all four sites, `intensity*` tokens |
| §10 | Fit from 3D left the camera tilted | resolved | `CameraController.fitBounds` carries `pitch` (`types.ts:109-115`, `adapter.tsx:40-46`) |

**New since the previous report:** ARCH-1..4, DUP-1..5, DUP-7, DUP-8, DEAD-1..4, ERR-1..5, TEST-1..2,
PERF-1..3, DEP-1..4, DOC-1..5. None is a regression of a previously resolved item; ERR-1, DUP-2 and
PERF-1 are adjacent to §4/§5/§6 and were not visible from those sections' scope.

## 7. Limits of this review

- **Not run:** `npm run verify`, a bundle, or a device. The previous report's "green" baseline is
  taken on trust; every "no consumer" claim rests on `grep`, not on the TypeScript program.
- **Read only through the contract:** `modules/share-intent/android/.../ShareIntentModule.kt` was
  read for the payload shape (`{ uri }`) and matches `index.ts`; its correctness on device (SEND
  intents, `clipData` vs `EXTRA_STREAM`) is not judged here.
- **Sampled, not read in full:** the 25 specs and 24 plans under `docs/superpowers/` (only the
  record-activity spec's patch section was read to anchor DOC-2); the test files other than the six
  named in §3.5; `src/data/db/migrations/meta/*.json` snapshots.
- **Plausible, unmeasured:** PERF-1 and PERF-2. The magnitude is inferred from the previous report's
  own cost estimate and from which memos are keyed on the trail reference; a profiler run on a
  3000-sample trail while switching tabs would confirm or deflate it.
- **Needs a device or runtime check:** ERR-1 (does the foreground notification survive a save
  reached via `'already-active'`? does `stopLocationUpdatesAsync` ever fail in practice?); ERR-2's
  behaviour for a `content://` URI that `expo-file-system`'s `File` cannot read (the catch at
  `new.tsx:38` covers it, but with no message); whether `expo-system-ui` is in fact required for
  `userInterfaceStyle: "automatic"` on this SDK before pruning (DEP-1 deliberately keeps it).
- **Hunches without an anchor** (kept out of §3): the Telegram → "Add trail" loop in `tasks.md`
  (a second share while `/trail/new` is open pushes a second instance; `useIncomingShare.ts:12`
  always `push`es) is consistent with the code but was not reproduced; `OfflineActionsMenu`'s
  `Dimensions.get('window')` is non-reactive, which only matters if the portrait lock in
  `app.config.ts` is ever lifted; `locationTask.ts` lets a repository rejection surface as an
  unhandled task error (points from that batch are lost silently) — acceptable for a background
  task but worth a one-line `catch` that at least keeps the in-memory store consistent.
