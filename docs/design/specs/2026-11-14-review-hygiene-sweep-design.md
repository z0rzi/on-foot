# Review hygiene sweep: the full review's small findings, closed with gates where drift recurs — Design

**Status:** Spec, built.
**From:** [[2026-11-14-full-review]], backlog rows 5, 6 and 8 and the minors of row 10 that need no
device and no measurement.
**Date:** 2026-11-14

## Problem Statement

The 2026-11-14 full review left about a dozen findings that are each small and low risk: docs that
lag the code, config that disagrees with itself, two failures the debug log never sees, and a gate
whose exemption list has no ticket behind it. One at a time they are not worth a branch. Left alone,
three of them will come back: the review found the same drift last time and the fix did not stick.

- `lint-debt.md` inventories the standing disables by hand. It listed all of them on 2026-09-10 and
  misses three today (DOC-1).
- `tsc`, eslint and jest ignore the agent directories in three separate lists. The previous review
  aligned `.claude/`, and `.scratch/` now differs (DEP-2, after the previous DEP-3).
- The three patched packages are declared with `~` ranges, so a patch release can slip in under a
  patch named for the exact version (DEP-3).

## Solution

One chore branch, three groups. Each fix is the review's, unless stated otherwise.

**Docs**
- **DOC-1.** Add the two missing subjects (`useRouteDisplay`'s `react-hooks/purity`,
  `TrailActions`' `react-hooks/refs`) to `lint-debt.md` "Standing inline exceptions". Gate **G1** holds it.
- **DOC-2.** In `AGENTS.md`, the seam paragraph introduces its four seams as "among them" and
  names `src/architecture/seams.ts` as the full list. The `verify` description names the
  architecture gates as a family (`src/architecture/__tests__/`) instead of listing five.
  `seams.md` already rules that other docs point at the registry rather than list it, so this is
  structural and needs no gate. Edited through the `writing-for-agents` skill.
- **DOC-3.** `src/map/provider/types.ts:231-239` states the follow contract without naming
  rnmapbox: callers turn follow off first, and a provider may drop a move while following. The
  rnmapbox reason stays in the adapter and `mapbox-gotchas.md`.

**Config and structure**
- **DEP-1.** Declare `globals` in `devDependencies`, at the version the lockfile already holds.
- **DEP-2.** Jest ignores `/.scratch/`. Gate **G2** holds it.
- **DEP-3.** Pin the three patched packages to the exact versions their patch files name. Gate
  **G3** holds it.
- **ARCH-2.** `MapCanvas.tsx:9` and `logExportText.ts:1` import their types from the leaf, with
  `import type`.
- **ARCH-3.** `tools` joins the scan roots of the cycle and duplication gates. The unused-export
  gate keeps it out: `cli.ts` is an entry point the gate does not model. `seams.md` states both.

**Failure logging**
- **ERR-3.** Both offline download failure paths (`offlineStore.ts`: the subscription's error
  callback and the kickoff `.catch`) log `warn` `'download failed'` with
  `{ stage: 'progress' | 'start', errorClass }`. They use the area of the download refusals in
  `downloadConsent.ts` (`'error'`). Test first, in `offlineStore.test.ts`. As built, `progress`
  carries no `errorClass`: the port's `onError` hands over only the SDK's message, and rnmapbox's
  `OfflinePackError` holds a message and the region's name, no class. `start` covers whatever
  fails before the subscription takes over, a `download` or a `resume` kickoff alike.
- **ERR-4.** `preferencesStore` gets an `onRehydrateStorage` that logs `warn` `'launch'`
  `'preferences hydration failed, defaults used'` with `{ errorClass }`. Test first, in
  `preferencesStore.test.ts`.

**Tracking**
- **DEAD-1.** File the triage of the 97 `PRE_EXISTING` unused-export exemptions as a ticket. The
  triage itself is not in this sweep.

### The three gates

Each follows the shape of `logErrorDetail.ts`: a pure function in `src/architecture/` and a test
in `src/architecture/__tests__/`. The test runs it once against the repo and once against a fixture
that must fail, so the false branch is tested.

- **G1, disables are inventoried.** Every scanned source file holding an `eslint-disable` directive
  is named in `lint-debt.md`'s "Standing inline exceptions" section. It matches on the file path, not
  the rule: the doc explains rules in prose, and a path is what a new disable reliably adds.
- **G2, gate scopes agree.** Every agent directory (`.claude`, `.scratch`, in one list in the gate)
  appears in jest's `testPathIgnorePatterns`, `tsconfig.json`'s `exclude` and eslint's `ignores`.
- **G3, patched packages are pinned.** For every `patches/<name>+<version>.patch`, `package.json`
  declares `<name>` at exactly `<version>`.

## Existing shape

- **Gates:** `src/architecture/logErrorDetail.ts` and its test, from DUP-2 this week, is the
  closest: a source scan, a pure predicate and a test against the real tree. G1 reuses
  `collectSourceFiles` from `sourceScan.ts`. G2 and G3 read config files, not sources, and share
  nothing with the scan beyond the test layout. If G2 and G3 both need a small JSON-file reader,
  it lives in `src/architecture/` and both use it.
- **ERR-3:** the refusal entries in `downloadConsent.ts:36-46`, same area and same detail style.
- **ERR-4:** `mapStore`'s `onRehydrateStorage` (`mapStore.ts:397-399`). It differs on purpose:
  `mapStore` stores the failure because `MapLaunchGate` decides on it and then logs. Preferences
  have no gate, since defaults are a complete state, so the hook logs directly.

## Failure modes

- **A gate fires on the existing tree.** Example: G1 with the two missing subjects, or the
  duplication gate on `tools/`, which has never been scanned. The fix is in the same change: add
  the doc line, or for a `tools/` twin, extract it or add a `DUPLICATION_EXEMPT` entry with a
  rationale. The `geometry.ts` twin of `metrics.ts` is deliberate and cross-checked, so if the gate
  sees it, it takes an exemption naming that cross-check.
- **A pin fails to install.** `patch-package` fails loudly on `npm install`. The pins equal the
  lockfile's resolved versions, which G3 also checks through the patch names, so install must give
  the same `node_modules`. Verified by a clean `npm ci` followed by `npm run verify`.
- **The new log calls throw.** `logEvent` is fire-and-forget and never throws
  (`debug-log.md`), so a logging failure cannot turn a handled download or hydration failure into a
  crash.
- **The offline error has no useful class.** On `start`, Expo's `CodedError` reads as `'Error'`
  (T-101), which improves the class for every site at once; `progress` has none at all. `stage`
  still separates the two paths.
- **Offline, permission denied, empty input, cancel, render throw:** not applicable. Nothing here
  adds a user-facing flow.

## Out of scope

- **ARCH-4** (the tag image's generator). T-100, lighter pins, redraws the pins. A note on T-100
  says the tag is drawn by `overview-pins.py` when it is redrawn, so the image is not drawn twice.
- **DUP-1** (one owner for the live segments), **DUP-3, DUP-4, DUP-6** (trail/activity sibling
  alignment), **ARCH-1** (the `mapStore` split): design-sized, a ticket each.
- **DUP-5:** changes layers and needs a device check, and the phone is taken.
- **PERF-1, PERF-2:** unmeasured. The field log can measure PERF-1 first.
- The DEAD-1 triage itself.

## Decisions taken without the owner

- **ARCH-3: scan `tools/` rather than declare it outside the gates.** The tooling is 1.8k lines,
  agent-written and growing, the same risk profile as `src/`. The alternative is one sentence in
  `seams.md` and no change to the gates.
- **DOC-2: point at the registry rather than gate the seam list in `AGENTS.md`.** A list kept
  complete by a test still costs every session the context. The four seams that are named carry
  per-seam guidance, which is why they stay.
- **G1 matches file paths, not rule names.** It is weaker: a second disable in a file already listed
  passes. It is also the only form that leaves the doc as prose.
