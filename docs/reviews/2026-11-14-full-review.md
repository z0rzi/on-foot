# Full review — on-foot-rn — 2026-11-14

**Scope.** Whole codebase at commit `c527106` (branch `master`, clean tree): `src/` (all areas),
`app/` (routes), `modules/share-intent` (through its TypeScript contract only), `tools/device-check`
(agent tooling, TypeScript), and the root configs (`package.json`, `tsconfig.json`,
`eslint.config.js`, `app.config.ts`, `.github/workflows/verify.yml`, `.husky/pre-push`, `patches/`).
Excluded: `android/` (generated), `node_modules/`, `.scratch/`, `.agents/` and `.claude/` skill text
(process docs, not product code), `src/data/db/migrations/meta/*.json` snapshots.

**Method.** I read in full: every file cited below, the whole map area (`MapScreen`, `MapCanvas`,
`MapInfoSheet`, the port `src/map/provider/`, the Mapbox adapter and every `overview*` file on both
sides of the port), the stores (`mapStore`, `trailsStore`, `activitiesStore`, `preferencesStore`,
`overviewBackfill`, `loadStoresAtLaunch`), the recording core (`recordingController`,
`recordingStore`, `locationTask`, the location port), the log module, `app/_layout.tsx`, the list and
import routes, the trail and activity sheets and action menus, the offline store, and the
architecture gates (`seams.ts`, `sourceScan.ts`, `importRules.ts`, `unusedExports.ts`). The rest of
`src/elevation`, `src/components`, `src/settings` and most of `tools/device-check` was sampled (see
§7). Consumers of every "unused" or "duplicate" claim were traced with `grep`; churn with `git log`
(282 commits since `9833610`). No gate was run and nothing touched the network. No `.codegraph/`
index exists, so CodeGraph was not used. Size: ~14.5k lines of production TS/TSX in
`src`/`app`/`modules`, ~1.8k in `tools/device-check`, 150 test files with ~1,300 cases.

**Previous report.** `docs/reviews/2026-09-10-full-review.md` (at `9833610`).

---

## 1. Verdict

The codebase is healthy, and it has kept its shape through two months and a large feature. All six
seams hold. Two more gates have arrived (export rules, unused exports). Every finding of the
previous report is closed or deliberately accepted, and every spec written since the
`## Failure modes` rule carries both required sections. The overview-on-map feature
(`670f1cd`) is the best evidence of the discipline. It extends the port with semantic types and
keeps every press and focus decision in pure, tested modules. Its degraded modes are logged by error
class. Two things matter most now:

- The **recording's failure paths are under-logged**, and the debug log is supposed to be the
  first place to look. A failed write of a fix batch reaches no log entry, and its `fix batch` entry
  is written before the write it describes (ERR-1). Failures to stop the stream are swallowed, and
  the log reads `stream stopped` regardless (ERR-2).
- The error convention **forked when `errorClass` arrived**. New code logs the error's class "because
  a message can quote the data at fault", but 24 older sites still log `String(error)`, several of
  them on paths that parse stored geometry (DUP-2).

Everything else is small: one derived value with four owners, sibling drift between the trail and
activity sides, a 400-line `mapStore`, and a few doc tables lagging the code. Trend: stable to
improving. Nothing regressed, and the new findings sit mostly in older code that new conventions
have overtaken.

## 2. Health dashboard

| Dimension | Status | Summary | Findings (must / should / minor) |
|---|---|---|---|
| Architecture & seams | 🟢 | Six seams intact, port stays semantic; `mapStore` has outgrown one job; a UI barrel import; `tools/` outside every gate; one generated asset without its generator | 0 / 1 / 3 |
| Duplication & drift | 🟠 | Live segments grouped by four owners; two error-detail conventions in the log; trail/activity siblings drifting | 0 / 2 / 4 |
| Dead code | 🟢 | No dead code found by hand; 97 exports exempted from the new gate as "pre-existing, triage" with no ticket | 0 / 0 / 1 |
| Error & failure handling | 🟠 | Fix-batch write failure invisible in the log; stream-stop failures swallowed and logged as success; offline download and preference-hydration failures unlogged | 0 / 2 / 2 |
| Test coverage of pure logic | 🟢 | Pure logic broadly tested, tests assert behaviour; the background task's failure path is untested | 0 / 0 / 1 |
| Performance hot spots | 🟢 | Activity selection parses the linked trail's whole geometry for its name; overview text rebuilt on each list focus (both plausible, unmeasured) | 0 / 0 / 2 |
| Dependency & config hygiene | 🟢 | `globals` imported but undeclared; jest does not ignore `.scratch/`; patched deps on `~` ranges | 0 / 0 / 3 |
| Documentation freshness | 🟢 | `lint-debt.md` misses three disables; `AGENTS.md` lists four of six seams; the port's comments name rnmapbox | 0 / 0 / 3 |

## 3. Findings by dimension

### 3.1 Architecture & seams

**ARCH-1 — `mapStore.ts` holds five jobs in 402 lines** · `src/store/mapStore.ts:10-146` (14 exported
pure helpers: follow-mode cycling, pitch policy, follow camera props, manual pitch, north button,
style quick-switch), `:148-183` (map mode, selection, pending fit types), `:185-402` (the store and
its persistence) · The file mixes camera-follow policy, style switching, the map-mode derivation, the
selection model and the persisted store. 96 of its 402 lines are comments (24%, was 22% of 275 at the
last review). 11 of its exports are exempted from the unused-export gate only because their tests
import them (`unusedExports.ts:114-124`). · Why: `AGENTS.md` "Keep units small and single-purpose…
a file that outgrows one clear job is a signal to decompose". Every camera change reopens the
selection store. · Fix: move the pure camera helpers (`nextFollowMode` … `manualPitchProps`,
`followCameraProps`) to a `src/map/followCamera.ts` and the style helpers (`StyleChoice`,
`satelliteToggleTarget`, `resolveQuickSwitch`) to `src/map/styleSwitch.ts`, with their tests. That
removes about 11 exemptions; the store keeps state and actions. · **should-fix, M** (pure moves;
low risk).

**ARCH-2 — A UI module imports a data barrel for a type** · `src/map/MapCanvas.tsx:9`
(`import { Trail } from '../data/trails'`), also `src/log/logExportText.ts:1`
(`import { LogEntry } from '../data/log'`) · `CODING_STANDARDS.md` "Imports at the data seam go to the
leaf, not the barrel": only the composition point imports a barrel, because the barrel constructs the
repository on the engine. Babel elides a type-only import, so no database opens today. But the rule is
structural, and `MapCanvas`'s own sibling `src/map/useRouteDisplay.ts:8` imports the same type from
`../data/trails/types`. Both lines are old (`c4ae809`, `9a5e72b`). · Fix: point both at the leaf with
`import type`. · **minor, S**.

**ARCH-3 — `tools/device-check` sits outside every structural gate, undeclared** ·
`src/architecture/sourceScan.ts:14` (roots `src`, `app`, `modules`) · The duplication, cycle,
unused-export and seam scans never see the 1.8k lines of `tools/device-check`. It already carries its
own sphere maths (`tools/device-check/geometry.ts:18-23`, a twin of `src/data/geo/metrics.ts:8-15`
that is deliberate and cross-checked by `tools/device-check/__tests__/appCrossCheck.test.ts`).
`docs/architecture/seams.md` describes the scan roots without saying that `tools/` is out of scope
or why. · Fix: either add `tools` to the roots for the duplication and cycle gates (the unused-export
gate would need `cli.ts` as an entry), or state in `seams.md` that agent tooling is outside the gates
and why. · **minor, S**.

**ARCH-4 — The tag image landed without its generator, in the commit that wrote the rule** ·
`src/map/providers/mapbox/overview-pin-tag.png`, `overview-pins.py:1` ("all but
overview-pin-tag.png"), `overviewPins.tsx:12` · `CODING_STANDARDS.md` "A generated asset lands with
its generator" was added in `670f1cd`, the same commit that added this 60×60 image with no script.
The plan names `.scratch/spike-overview/` as the origin of the pill image, which is exactly the
"script left in a scratch folder" case the rule exists for. T-100 (lighter pins) will have to redraw
it. · Fix: draw the tag in `overview-pins.py` (a white rounded box with the stretch metadata in
`pinLayout.ts:13-20`) and check it reproduces the committed file byte for byte. · **minor, S**.

Clean otherwise. No forbidden import outside `src/map/providers/`, `src/data/db/`, `src/net/`,
`src/location/`, `src/external/` or `modules/share-intent/`. The overview extends the port with
semantic types (`OverviewItem`, `OverviewLineFocus`, `OverviewPress`, `src/map/provider/types.ts:103-201`),
and the provider "reports what it hit and never picks among it". `expo-file-system` reached a third
file inside the provider directory, and `seams.md` recorded it in the same change. The data layer
imports no UI.

### 3.2 Duplication & pattern drift

**DUP-1 — The live track is grouped into segments by four owners** · `src/map/MapCanvas.tsx:88`,
`src/map/profileSource.ts:21` (via `useRouteDisplay`), `src/recording/usePersonalFactor.ts:11`,
`src/recording/RecordingFigures.tsx:25`, all `groupPointsBySegment(livePoints)` from
`src/data/activities/mapping.ts:72` · The store keeps flat points
(`src/recording/recordingStore.ts:33`), and each consumer derives the same `TrackPoint[][]` on its
own, once per fix batch. · Why: `CODING_STANDARDS.md` "Derived or cached state has one owner". A
fifth consumer will copy whichever site it opens first. The cost is **not** the concern: at the 10 m
minimum distance and 15 s batches (`src/recording/options.ts:7-8`), a 20 km hike is about 2,000
points, so the four passes are sub-millisecond. · Fix: one `useLiveSegments()` selector in
`src/recording/` (memoised on `livePoints`), or keep the segmented shape in the store beside the
flat list. The four sites then read it. · **should-fix, S**.

**DUP-2 — Two conventions for an error in the debug log** · class only: `src/log/errorClass.ts:1-4`
("its class, never its message, which can quote the data at fault"), 10 sites (overview,
backfill, map-store hydration, launch loads). Message: 24 `String(error)` sites, among them
`src/components/useLoadedEntity.ts:40` (the trail and activity loads, which `JSON.parse` the stored
geometry, `src/data/trails/mapping.ts:25-31`), `src/activities/linkedTrail.ts:26`,
`src/trails/useTrailActionsMenu.ts:28` and `app/activity/save.tsx:40`. Also message plus stack at
`src/components/ErrorBoundary.tsx:42-46` and `src/log/installGlobalErrorHandler.ts:17-19` · The
newer rule was introduced with a privacy reason ("a parse error's message can quote the geometry it
failed on", `docs/architecture/debug-log.md:140`), and the log's invariant is "No coordinates, ever"
(`debug-log.md:214`). By the project's own reasoning, the older sites that log the message of a
failed geometry read are exposed to the same risk. Nothing documents which errors may carry a message:
`debug-log.md:207` "Native error messages" justifies only two exceptions. · Why: a pattern changed in
one place and not everywhere (`AGENTS.md` "change it deliberately and everywhere — don't fork it").
· Fix: decide the rule once in `debug-log.md`, for example class everywhere except native messages
and stacks with no payload, and migrate the read paths (`useLoadedEntity`, `linkedTrail`,
`useTrailActionsMenu`, `save.tsx`) to `errorClass`. Whether Hermes's `JSON.parse` messages actually
quote input is unverified (§7). · **should-fix, S–M**.

**DUP-3 — The trail and activity siblings have made different choices** · Lists:
`app/trails.tsx:23,25` uses a hook (`useTrailActionsMenu`) and a named failure
(`TRAILS_REFRESH_FAILURE`), where `app/activities.tsx:19,22-25` keeps the menu in an inline
`useState` and the failure as an inline literal. Metric tiles: `trailMetricTiles`
(`src/trails/format.ts:19-25`, extracted in `97acb96`) serves the trail sheet and the trail form,
while `src/map/ActivityInfoSheet.tsx:40-48` and `src/activities/ActivityForm.tsx:77-83` each inline
their own tile list. Styles: `titleRow`/`name`/`summaryRow`/`summary` are verbatim in
`src/trails/TrailInfoSheet.tsx:81-85` and `src/map/ActivityInfoSheet.tsx:77-80`. Placement: the trail
sheet lives in `src/trails/` and the recording sheet in `src/recording/`, but the activity sheet in
`src/map/`. · Why: `CODING_STANDARDS.md` "Sibling functions make the same choices". Each pair passes
the duplication gate because the copies are short or renamed. · Fix: `activityMetricTiles(metrics,
variant)` in `src/activities/format.ts`, a shared sheet title-row component (or style), the activity
refresh failure as a named constant beside the trails one, and `ActivityInfoSheet` moved to
`src/activities/`. · **minor, S**.

**DUP-4 — `PausedControls` re-derives the recording's trail** · `src/map/PausedControls.tsx:34-35`
(`sel?.kind === 'trail' ? sel.id : null`) duplicates `alongTrailId` (`src/recording/alongTrail.ts:15-18`),
whose comment names this very call site as the consumer ("the shown trail is linked to the activity
at Stop (PausedControls)"). `currentAlongTrailId()` (`src/recording/currentAlongTrail.ts:5`) exists
for imperative reads. · Fix: `linkTrailForSave(currentAlongTrailId())`. · **minor, S**.

**DUP-5 — Two near-identical layer blocks in `RouteOverlay`** · `src/map/providers/mapbox/adapter.tsx:237-256`
(slope source) and `:257-278` (plain source). Casing plus line plus arrows are repeated, differing
only in ids and `lineColor`, and each block is under the gate's 8-line window. · Fix: one
`routeLineLayers(idPrefix, lineColor)` helper inside the adapter. Device-check per
`mapbox-gotchas.md`, since layer ids and stacking change. · **minor, S**.

**DUP-6 — The DUP-7 residue: `removeForTrail` filters packs by hand** ·
`src/map/offline/offlineStore.ts:123-124` (`parsePackId(p.id)?.trailId === trailId`, twice) · DUP-7
of the previous report created `packsForTrail` (`src/map/offline/packId.ts:17`), but this site
carried no non-null assertion and was missed. · Fix: use `packsForTrail` for the registry packs and
the same predicate for the progress keys. · **minor, S**.

### 3.3 Dead code

**DEAD-1 — 97 unused-export exemptions carry a placeholder rationale and no ticket** ·
`src/architecture/unusedExports.ts:18` (`PRE_EXISTING = 'pre-existing, triage'`), `:28-131` · The
new gate (`c527106`) exempts 97 existing exports "for triage". The worklist has no ticket for it,
although `AGENTS.md` says nothing is open work until it lands in the worklist. Every one I sampled
(19 of the 97) is a test seam rather than dead code: it is used inside its own file and imported by
its test (e.g. `computeMetrics`, `slopeBands`, `toLocationFix`, `flushLog`, and the re-export at
`src/map/providers/mapbox/capabilities.ts:3`, imported only by `capabilities.test.ts`). They deserve
the honest rationale the gate already offers for the same shape (`HOOK_CORE`, `MAPPING_CORE`,
`FIXTURE_TYPE`, `:19-21`), and a placeholder that reads like a rationale makes the next lazy entry
indistinguishable from these. · Fix: file the triage as a ticket now; then relabel the test seams
under a "tested directly" rationale, and delete `export` where the test can go through the public
function. · **minor, S** (ticket) / **M** (triage).

Clean otherwise: no `TODO`/`FIXME`, no `console.*` outside the CLI, no commented-out code, no
`@ts-ignore`, `DUPLICATION_EXEMPT` empty, every `AppColors` key and `MapTokens` key read.

### 3.4 Error & failure handling

**ERR-1 — A failed fix-batch write reaches no log, and its `fix batch` entry claims it kept the
fixes** · `src/recording/locationTask.ts:193-196` (the `fix batch` entry with `kept: n` is logged,
then `appendPoints` runs) and `:208` (the rejection goes back to the task manager, uncaught and
unlogged) · When `getActiveSession`, `getLastSegmentPoint` or `appendPoints` rejects, the batch is
lost silently. `debug-log.md:240-243` ("Known limits") says unhandled rejections are not captured, so
"each known rejection site logs its own failure", and this one, the most important write in the app,
does not. A field report of a gap in a track would show a healthy `fix batch` entry for the very
batch that was dropped. · Fix: log `fix batch` after the append (or log a `kept` outcome there),
and wrap `recordDelivery` in a `.catch` that writes `warn capture 'fix batch not stored'` with
`errorClass` and the counts. `heldCandidate` should not advance on a failed append. Write the test
first (TEST-1). · **should-fix, S**. · **Done**: `fix batch` is logged after the write; a failed write logs `fix batch not stored` with the gate's counts and `errorClass`; the candidate does not move forward.

**ERR-2 — Stream-stop failures are swallowed and logged as success; discard disagrees with finish**
· `src/recording/recordingController.ts:135-142` (pause logs `stream stopped` **before** it tries,
then an empty `catch`), `:274-280` (finish swallows the failure, then logs `stream stopped`),
`:254-258` (launch, empty `catch`), against `:190-193` (discard sets the store to stopped, then lets a
stop failure reject the whole discard, so the session row survives and the user sees "discarding the
activity failed") · The three tolerant paths are deliberate and commented, but the debug log never
learns that a stop failed, and on pause it says the opposite. Discard is a sibling of finish and makes
the opposite choice. · Why: `CODING_STANDARDS.md` "Sibling functions make the same choices", and the
debug log is the first place a field bug is read. · Fix: one `stopStreamTolerant(reason)` helper in
the controller that tries the stop, logs `stream stopped` or `warn capture 'stream stop failed'`
(`errorClass`), and never throws. Pause, finish, discard and launch then use it (or discard keeps
aborting, stated in a comment). Add the failure-path tests beside the existing ones. · **should-fix,
S**. · **Done**: `stopStreamTolerant()` is used by all four paths, and discard is now tolerant like finish. The port's stop reports whether a stream was running, so `stream stopped` is logged only when one was. Device check still pending.

**ERR-3 — Offline download failures are invisible in the debug log** ·
`src/map/offline/offlineStore.ts:65-69` (subscription `onError` drops its `message`) and `:89-93`
(kickoff rejection) · The UI shows a failed pack, but the log records only the refusals before a
download (`downloadConsent.ts:36-46`), never the failure of one that started. · Fix: `logEvent('warn',
'map', 'offline download failed', { stage, errorClass })` in both. The SDK's message names the pack,
which has no position, so it is safe if wanted. · **minor, S**.

**ERR-4 — The preferences store's hydration failure is silent** · `src/settings/preferencesStore.ts:31-49`
(no `onRehydrateStorage`), against its sibling `src/store/mapStore.ts:397-399` · The writes are already
guarded (`writesAfterHydration`), so no data is lost. The user just runs on defaults with no trace in
the log. · Fix: the same `onRehydrateStorage` → `logEvent('warn', 'settings', …, { errorClass })`.
· **minor, S**.

Clean and defensible: the overview's degraded modes match its spec's `## Failure modes` one for one
(derivation throw → empty overview, logged once; file write failure → previous file kept; press
during a style reload → logged, nothing selected). The recording chain's serial turns, the
`useLoadedEntity` outcomes, the GPX import's four distinct failures, and `guardDownload`'s fail-open
are also sound.

### 3.5 Test coverage of pure logic

**TEST-1 — The background task's failure path is untested** · `src/recording/__tests__/locationTask.test.ts`
covers gating, anchoring, candidates, serial deliveries and faults (16 cases) but has no case where
the repository rejects. · Fix: one test where `appendPoints` rejects, asserting the log entry and
that the live store and `heldCandidate` are unchanged. Write it before ERR-1. · **minor, S**. · **Done**.

Clean otherwise. Every pure decision added since the last review has a test file, among them the
press resolution, line focus, pin list, cluster list, file lifecycle, tag throttle, launch camera,
heading monitor, fix gate, trail progress and trail ahead. Pure helpers without a file of their own
(`downloadBatches`, `writesAfterHydration`, `latestWins`) are exercised through their store's tests
(`offlineStore.test.ts:156-276`, `preferencesStore.test.ts:37-68`, `trailsStore.test.ts:116`). The
tests sampled assert store state and logged entries, not mock call counts alone.

### 3.6 Performance hot spots

**PERF-1 — Selecting an activity parses its linked trail's whole geometry for a name and an id** ·
`src/activities/linkedTrail.ts:22` (`getTrail`, full row and `JSON.parse`), consumed only for
`linkedTrail.id`/`.name` at `src/map/ActivityInfoSheet.tsx:54-68`. It is re-run on every trail
mutation too (`src/map/useSelectedActivity.ts:14` sums both stores' versions) · *Plausible, not
measured*: the `route loaded` entry already includes this read in its `ms` (`debug-log.md` "The route
timing entries"), so the field log can confirm it. · Fix: read the linked trail's summary (a
`getTrailSummary` on the repository, or the row already held by `useTrailsStore`). Keep the
"same load" guarantee that `linkedTrail.ts:9-11` gives. · **minor, S**.

**PERF-2 — The overview's lines text is rebuilt and compared on every list focus** ·
`src/map/overview/OverviewLayer.tsx:57` (memo keyed on the store arrays), `src/store/trailsStore.ts:29`
(each `loadTrails` sets a new array, and the Trails tab and Offline maps screen reload on focus),
`src/map/providers/mapbox/overviewFiles.ts:38` (full-string compare before the write) · On unchanged
data, nothing is written, but the whole FeatureCollection string is joined and compared on the JS
thread each time, and nothing logs that cost (`overview loaded` fires only on a write). *Plausible
only*: it scales with the total stored overview geometry, and at today's data sizes it is likely
negligible. · Fix (only if a measurement says so): skip the rebuild when the rows' ids and
`overviewGeometry` references are unchanged, or have `loadTrails` keep row identity for unchanged
rows. · **minor, S**.

Clean: the previous report's hot-path fixes hold (`version`-keyed revalidation, one route-display
derivation keyed on the segments array). The overview is a file the engine reads on its own threads
(D138), with writes coalesced in 100 ms bursts (`useOverviewFile.ts:26`).

### 3.7 Dependency & config hygiene

**DEP-1 — `globals` is imported but not declared** · `eslint.config.js:3` (`require('globals')`)
resolves through hoisting from `eslint`/`eslint-config-expo` (`package-lock.json`: `globals@16.5.0`)
· A dependency bump that stops hoisting it breaks `npm run lint` with no change to the repo. · Fix:
add `globals` to `devDependencies`. · **minor, S**.

**DEP-2 — Jest's scope differs from `tsc` and eslint on `.scratch/`** · `package.json:75`
(`testPathIgnorePatterns`: `node_modules`, `.claude/worktrees` only), against `tsconfig.json:24` and
`eslint.config.js:18` (both exclude `.scratch/**`) · A throwaway `*.test.ts` dropped in `.scratch/`
runs in `npm run verify`, the scope drift the previous DEP-3 closed for `.claude/`. · Fix: add
`/.scratch/`. · **minor, S**.

**DEP-3 — Patched packages are declared with `~` ranges** · `package.json:7,18,24`
(`@gorhom/bottom-sheet ~5.2.14`, `expo-location ~57.0.11`, `expo-task-manager ~57.0.12`), against
patch files named for the exact versions (`patches/*`) · The lockfile pins them today, but an
`npm install` that resolves a patch release moves the dependency under its patch, which is the
"silently stops applying" debt that `docs/architecture/native-patches.md:3-5` warns about. · Fix:
pin the three exactly, so a bump is a visible, deliberate edit (and `/deps-check` sees it). ·
**minor, S**.

Clean otherwise: no unused runtime dependency (each is imported, a config plugin, or a declared peer;
`expo-system-ui` kept on purpose per the previous DEP-1). `.env` is untracked and enforced, CI and the
pre-push hook both run exactly `npm run verify`, and every patched native module is in
`buildFromSource`.

### 3.8 Documentation freshness

**DOC-1 — `lint-debt.md` lists four standing disables; the code has seven** ·
`docs/architecture/lint-debt.md:35-53` · Missing: `src/map/useRouteDisplay.ts:36,39`
(`react-hooks/purity`, a timing for the log, added in `1b34a63`) and `src/trails/TrailActions.tsx:83`
(`react-hooks/refs`, added in `97acb96`). Both carry honest inline justifications, so this is
inventory drift, not a quality breach. · Fix: add the two subjects to the "Standing inline exceptions"
list. · **minor, S**.

**DOC-2 — `AGENTS.md` names four seams; `SEAMS` has six** · `AGENTS.md:26-33` ("Today: the map SDK…
the database engine… connectivity… location") leaves out `external-apps` (`expo-linking`) and
`native-modules` (`expo-modules-core`), `src/architecture/seams.ts:38-51`. `seams.md` says "other
docs point here rather than listing seams". The same paragraph's description of `verify` ("types,
tests, seams/secrets/cycles/duplication, lint") omits import rules, export rules and unused exports.
· Fix: end the list with "and the rest in `seams.ts`", or list all six, and name all the gates. ·
**minor, S**.

**DOC-3 — The port's comments state an rnmapbox behaviour as a port rule** ·
`src/map/provider/types.ts:231-239` ("an imperative move is a no-op while rnmapbox is following") ·
`AGENTS.md` keeps provider concepts off shared code so that MapLibre stays reachable. The constraint
that callers turn follow off first is a fine contract, but its reason is named for one SDK. · Fix:
state it as the port's contract ("callers turn follow off first; a provider may drop a move while
following") and keep the rnmapbox detail in the adapter and `mapbox-gotchas.md`. · **minor, S**.

Clean otherwise: `README.md`, `seams.md`'s table and candidates, `GLOSSARY.md` (overview, pin,
cluster and family are all defined), `mapbox-gotchas.md`, `native-patches.md` and the debug log's
area list match the code. Every spec since the 2026-10-11 rule carries `## Existing shape` and
`## Failure modes`.

## 4. Known debt inventory

| Debt | Count / where | Governing rule |
|---|---|---|
| `@react-native-async-storage/async-storage` outside a seam | 2 files: `src/store/mapStore.ts:3`, `src/settings/preferencesStore.ts:3`, now with the identical `writesAfterHydration(createJSONStorage(() => AsyncStorage), …)` shape in both, which is the "persisted-preferences wrapper" the candidate list names | `seams.md` "Candidates under review" |
| `expo-file-system` outside a seam | 3 files (was 2): `src/data/trails/gpx/readFile.ts`, `src/map/offline/diskSpace.ts`, `src/map/providers/mapbox/useOverviewFile.ts`; the third was registered in `seams.md` in its own change | same |
| Unused-export exemptions | 105 entries: 1 directory (`src/architecture/`), 97 `PRE_EXISTING` (largest: `mapStore.ts` 11, `data/activities/mapping.ts` 7, `trailProgress.ts` 5), 7 with a specific rationale | `unusedExports.ts`; triage untracked (DEAD-1) |
| Justified lint escapes | 7 directives in 6 files: `RecordButton`, `MapControls`, `useMovingStopwatch`, `parse.ts` (the `any` block), `useRouteDisplay` ×2, `TrailActions` | `lint-debt.md` (stale, DOC-1) |
| Dead column `recording_sessions.ended_at` | `src/data/db/schema.ts:46` | health-check §8, needs a migration |
| Legacy geometry shape `{ points }` | `src/data/trails/mapping.ts:29`, `src/data/activities/mapping.ts:64` (tested) | backward compatibility for pre-segment rows |
| GPX waypoints parsed and stored, never rendered | `src/data/trails/gpx/parse.ts:74`, `types.ts:11` | ticket T-28 |
| Renamed-copy store pair | `trailsStore.ts` / `activitiesStore.ts` (each now carries `version`, `commit`, `latestLoad`), mirrored again in `overviewBackfill.ts:21-34` | previous DUP-6: accept until a third entity store appears |
| Assets older than the generator rule | `src/map/providers/mapbox/puck-bearing-arrow.png`, `puck-transparent.png` | `CODING_STANDARDS.md` "A generated asset lands with its generator" (applies to new assets; see ARCH-4) |
| Comment density in `mapStore.ts` | 96 of 402 lines (24%) | health-check §8 "worth watching"; see ARCH-1 |
| Android-only surfaces | `src/components/toast.ts`, `modules/share-intent` | the app's declared target |

## 5. Refactor backlog — top 10

| # | Item | Resolves | Benefit | Cost | Regression risk | Recommendation |
|---|---|---|---|---|---|---|
| 1 | ~~Catch and log a failed fix-batch write; log `fix batch` after the append; test first~~ | ERR-1, TEST-1 | High: the one silent data-loss path in the recording becomes visible in the field log | S | Low (locationTask tests) | **done** |
| 2 | ~~One tolerant stream-stop helper that logs its outcome; decide discard's choice~~ | ERR-2 | High: the log stops claiming a stop that failed; siblings agree | S | Low-medium (controller tests; device check of the notification) | **done** (device check pending) |
| 3 | One rule for error detail in the log, written in `debug-log.md`; migrate the geometry-read sites to `errorClass` | DUP-2 | Medium-high: closes a fork with a privacy invariant behind it | S–M | Low | **now** |
| 4 | `useLiveSegments()`, one owner of the live track's segments | DUP-1 | Medium: the derived-state rule held for the recording's hottest value | S | Low | **next** |
| 5 | Doc refresh: `lint-debt.md` disables, `AGENTS.md` seam and gate list, the port's follow comment | DOC-1..3 | Medium: first-read docs match the registry | S | None | **next** |
| 6 | File the unused-export triage ticket; relabel test seams honestly | DEAD-1 | Medium: the gate's escape list becomes trustworthy | S (ticket), M (triage) | None | **next** |
| 7 | Trail/activity sibling alignment: activity tiles helper, named refresh failure, sheet title row, `ActivityInfoSheet` → `src/activities/`; `PausedControls` → `currentAlongTrailId`; `removeForTrail` → `packsForTrail` | DUP-3, DUP-4, DUP-6 | Medium: the next agent copies one pattern, not two | S | Low | **next** |
| 8 | Config hygiene: declare `globals`, jest ignores `.scratch/`, pin the three patched deps, draw the tag in `overview-pins.py`, declare `tools/` gate scope | DEP-1..3, ARCH-3, ARCH-4 | Low-medium | S | Low | **next** |
| 9 | Split `mapStore.ts`: follow-camera and style-switch helpers into their own modules | ARCH-1 | Medium: smaller units, about 11 fewer exemptions | M | Low | **later** |
| 10 | Small leftovers: leaf type imports (ARCH-2), adapter layer helper (DUP-5, device-check), offline and preference failure logs (ERR-3, ERR-4), linked-trail summary read (PERF-1) | ARCH-2, DUP-5, ERR-3, ERR-4, PERF-1 | Low-medium | S | Low (DUP-5: medium, layers) | **later** |

**Top three, in one sentence each.**

1. The fix-batch write is the only place where a recording can lose data with no trace at all.
   A `.catch` and a reordered log line make it readable from Settings → Debug log, for one test.
2. The stream-stop helper makes the controller's log tell the truth about the foreground service.
   It also puts discard and finish on the same side of a deliberate trade-off.
3. The error-detail rule closes the one convention that forked when the overview introduced
   `errorClass`, and it is the fork with the "no coordinates, ever" invariant behind it.

## 6. Continuity with the previous report

`docs/reviews/2026-09-10-full-review.md`. Each item was checked against the current tree.

| ID | Title | Status | Note |
|---|---|---|---|
| ARCH-1 | Formatters in the data layer | resolved | `src/format/units.ts`; `IMPORT_RULES` and `exportRules.ts` hold it |
| ARCH-2 | Native boundary outside the scanner | resolved | `modules` is a scan root; `native-modules` seam |
| ARCH-3 | Double cast at the map seam | resolved | `trackingModeFor` (`providers/mapbox/followMode.ts`), no cast |
| ARCH-4 | `caps.offline` gate that did not exist | resolved | flag deleted, ADR 0002; port comment states the invariant (`types.ts:285-289`) |
| ARCH-5 | Gate covered the import, not the shape | resolved | `exportRules.ts` |
| DUP-1 | Two bounding-box computations | resolved | `boundsForTrail` builds on `boundsForPoints` (`offline/bounds.ts:17-21`) |
| DUP-2 | Profile and banding, three owners | resolved | `useRouteDisplay` is the one derivation |
| DUP-3 | Load-by-id shape ×5 | resolved | `useLoadedEntity` for the three id-keyed loads |
| DUP-4 | Verbatim twins under the window | resolved | `LoadingScreen`, `newTrailHref` |
| DUP-5 | Two theme tokens for one role | resolved | `controlsText` gone |
| DUP-6 | Trail/activity store pair | still open (accepted) | grew a `version`/`commit`/`latestLoad` each, still mirrored (§4) |
| DUP-7 | Filter-then-assert on `parsePackId` | resolved, with a residue | `packsForTrail`; `removeForTrail` missed (DUP-6 here) |
| DUP-8 | Two selection-freshness mechanisms | resolved | both lists clear through the hook; `forgetEntity` |
| DUP-9 | Two route-line components | resolved / closed | one `RouteOverlay`; live line deliberately plain |
| DUP-10 | Which route is on screen, decided twice | resolved | `display.kind` gates the colouring (`MapCanvas.tsx:94`) |
| DUP-11 | Formatter mirror divergence | resolved | `formatTrailSummary`, `·` in both |
| DEAD-1 | `isValidCapabilities` and unread flags | resolved | `MapCapabilities` is what is read |
| DEAD-2 | Unread theme tokens | resolved | every `AppColors` key has a consumer |
| DEAD-3 | `SizeEstimate.tileCount` | resolved | gone |
| DEAD-4 | `NetInfoState` re-export | resolved | not re-exported |
| ERR-1 | Orphaned stream never stopped | resolved | `resumeIfActive`, `finishRecording`, though their stop failures go unlogged (ERR-2 here) |
| ERR-2 | Empty/non-GPX file became a trail | resolved | `GpxError`, four distinct import failures |
| ERR-3 | `void load().then` with no failure | resolved | `useLoadedEntity` error status |
| ERR-4 | Silent no-ops | resolved | toast while recording; packs reload on focus |
| ERR-5 | Picker rejection | resolved | `app/trails.tsx` try/catch |
| ERR-6 | Metrics outside the `try` | resolved | its own `metrics` outcome |
| ERR-7 | Dangling `linked_trail_id` | resolved | nulled in the delete's transaction, migration 0008 |
| TEST-1 | `formatBytes`, `packDescriptor`, download decision | resolved | all tested |
| TEST-2 | GPX with no points | resolved | seven cases on the reason |
| PERF-1 | Selected entity re-read on every tab focus | resolved | `version`-keyed revalidation |
| PERF-2 | Triple profile derivation | resolved | with DUP-2 |
| PERF-3 | Progress ticks re-render the trail sheet | still open (accepted, "none") | `TrailInfoSheet.tsx:27-31` still subscribes to `progress` |
| DEP-1 | Six unused deps | resolved | pruned |
| DEP-2 | `@types/jest` ahead of jest | resolved | `^29.5.14` |
| DEP-3 | Gate scope drift for worktrees | resolved, adjacent drift | `.claude/**` agreed; `.scratch/**` now disagrees (DEP-2 here) |
| DEP-4 | Workspace files not ignored | resolved | `.serena/`, `/run-app.sh` ignored |
| DOC-1 | README was the template | resolved | rewritten, current |
| DOC-2 | Permission justified by removed behaviour | resolved | `app.config.ts:17-19` |
| DOC-3 | Stale adapter comment | resolved | `adapter.tsx:98-102` names both affordances |
| DOC-4 | Drifts in the architecture docs | resolved, new adjacent drift | the attributions were fixed; three newer disables are missing (DOC-1 here) |
| DOC-5 | `offline` capability comment | resolved | states the invariant, cites ADR 0002 |
| FIELD-1 | Background kills | closed (owner, 2026-11-06) | — |
| FIELD-2 | Recording sheet missing | closed | one `MapInfoSheet` instance (`MapScreen.tsx:96-111`) |
| FIELD-3 | Interruption toast hidden | resolved | waits for `onMapLoaded` |
| FIELD-4 | expo-location crash after revoke | closed | patch plus `buildFromSource` |
| FIELD-5 | Crash in a relaunched process can hang | still open | now ticket `T-5`, `needs-info` |

Previous §7 hunches: `ActionsMenu`'s non-reactive `Dimensions` is **resolved**
(`useWindowDimensions`, `ActionsMenu.tsx:29`). The `locationTask` repository-rejection hunch is now
**anchored** (ERR-1). The share-intent double `push` stays a hunch (§7).

**New since the previous report:** ARCH-1..4, DUP-1..6, DEAD-1, ERR-1..4, TEST-1, PERF-1..2,
DEP-1..3, DOC-1..3. None is a regression of a resolved item. Three sit next to closed ones: ERR-2
(the stop paths ERR-1 created), DEP-2 (DEP-3's scope fix, one directory short) and DOC-1 (the
inventory DOC-4 corrected, since outgrown).

## 7. Limits of this review

- **Not run:** `npm run verify`, a bundle, the app or a device. The claim that verify is green is
  taken on trust. Every "no consumer" claim rests on `grep`, not on the TypeScript program.
- **Sampled, not read in full:** `src/elevation/` beyond `ElevationGraph.tsx` (first 80 lines),
  `useGraphPuck` and the files the review cited; `src/components/` beyond the files cited;
  `src/settings/LogList.tsx`; `MapControls.tsx`, `LayersSheet.tsx`, `CardFrame.tsx`; 6 of the 30
  `tools/device-check` modules (`cli.ts`, `geometry.ts`, the cross-check test header); the specs
  other than overview-on-map's `## Existing shape`/`## Failure modes`; the tickets beyond their names
  and T-5.
- **Unverified premise of DUP-2:** whether Hermes's `JSON.parse` error messages quote the input they
  failed on. The project's own `errorClass` rationale asserts that a parse message "can quote the
  data at fault". The finding stands as a convention fork either way. Its privacy weight depends on
  this.
- **Plausible, unmeasured:** PERF-1 (the `route loaded` entry's `ms` for an activity with and
  without a linked trail would measure it) and PERF-2 (needs a timing around `linesFile` plus the
  compare on a focus reload with many items).
- **Needs a device check after a fix:** DUP-5 (layer ids and stacking, against `mapbox-gotchas.md`)
  and ERR-2 (that the foreground-service notification still goes on every path).
- **Hunch, no anchor:** `useIncomingShare.ts:13,22` always `push`es `/trail/new`, so a second share
  while the import screen is open stacks a second instance. It is consistent with the code but not
  reproduced.
