# Architecture seams

A **seam** is an inviolable boundary: a native SDK or engine that only one directory may
import, so the rest of the app stays provider-agnostic and swappable. Seams are declared as
data in one place and enforced automatically.

## The registry is the source of truth

All seams live in `src/architecture/seams.ts` as the `SEAMS` array. Each entry:

```ts
{
  name: 'map-provider',
  tokens: ['@rnmapbox/maps'],      // import specifiers that are forbidden outside the boundary
  allow: ['src/map/providers/'],   // the only path prefix(es) allowed to import those tokens
  rationale: '…',                  // one line, printed in the failure message so it teaches
}
```

The `seams` Jest test (`src/architecture/__tests__/seams.test.ts`) scans all production
source (`src`, `app` and the local Expo modules under `modules`, excluding `__tests__`,
`build` and `node_modules`) and fails if any file outside `allow` imports a
forbidden token. It runs with every `npm test` / `npm run verify`, locally, in the pre-push
hook, and in CI. `SEAMS` is the only source of truth: other docs point here rather than listing
seams, and the table below mirrors the array — if they ever disagree, the array is right.

Five sibling gates use the same scan: `importRules.ts` (one-way directory bans on what a
directory may *import*), `exportRules.ts` (directory-scoped bans on what a directory may
*export* — today, nothing under `src/data/` may export a `format` symbol followed by a capital
letter), `moduleEntries.ts` (modules whose `index` is the only file outside code may import —
today `src/log`), `duplication.ts` (verbatim copies of 8+ significant lines, across or within
files) and `unusedExports.ts` (every export has an importer outside its own file and the tests;
its header states how barrels, `export *`, defaults, types and expo-router routes are counted).
All five fail `npm run verify` with a report naming the files. For `importRules.ts`,
`duplication.ts` and `unusedExports.ts` the only escape is a registered entry with a rationale,
never an inline disable; `exportRules.ts` and `moduleEntries.ts` have no exemption mechanism at
all.

The cycle (`importGraph.ts`) and duplication gates also scan the agent tooling under `tools/`
(`APP_AND_TOOLING_ROOTS` in `sourceScan.ts`): it is agent-written code of the same risk as `src/`. The
seam, import-rule, export-rule, module-entry and unused-export gates model the app and leave it out;
the unused-export gate would also misread `tools/device-check/cli.ts`, an entry point nothing imports.

`headlessEntry.ts` holds the bundle entry, which Android also runs for a background location
delivery with no route rendered (`docs/design/specs/2026-11-14-recording-survives-process-death-design.md`
§1). It reads the root `index.ts`, outside the scan roots, and `package.json`'s `main` beside the
app's source: `main` is `index.ts`, which imports `src/bootstrap` then `expo-router/entry` and
nothing else; bootstrap imports `src/recording/locationTask` last; nothing under `app/` imports it;
and the task's runtime import graph (whole-declaration `import type` left out) reaches nothing
under `src/map/` or `src/components/`, no `.tsx` file, and no file that calls `setTimeout` or
`setInterval`, since a headless host's JS timers stay paused. It has no exemption mechanism.

Three more gates in `src/architecture/` read the repo's docs and config rather than its imports:
`lintDebt.ts` (every source file under `src`, `app`, `modules` or `tools` holding an
`eslint-disable` is named in `lint-debt.md`'s standing exceptions), `gateScopes.ts` (jest, `tsc`
and eslint all ignore every agent directory in `AGENT_DIRS`) and `patchPins.ts` (every package
under `patches/` is declared at exactly the version its patch file names). None has an exemption
mechanism: the fix is the doc line, the ignore entry or the pin.

## How to add a seam

When a change introduces a new boundary — a wrapper around a native SDK, or a new provider
port — register it **in the same change**:

1. Add one entry to `SEAMS` with the forbidden `tokens`, the `allow` prefix, and a `rationale`.
2. Run `npm test`. If existing code already violates the new seam, either move the offending
   import behind the boundary or widen `allow` deliberately.

That is the whole process. One array entry; the test, the gate, and the docs follow.

## Seams enforced today

| name | tokens | allow |
|------|--------|-------|
| `map-provider` | `@rnmapbox/maps` | `src/map/providers/` |
| `persistence` | `expo-sqlite`, `drizzle-orm` | `src/data/db/` |
| `net` | `@react-native-community/netinfo` | `src/net/` |
| `location` | `expo-location`, `expo-task-manager` | `src/location/` |
| `external-apps` | `expo-linking` | `src/external/` |
| `native-modules` | `expo-modules-core` | `modules/share-intent/`, `modules/check-hooks/` |

## The persistence seam's row types are checked, not cast

`src/data/*/mapping.ts` declares hand-written `Row` interfaces so the domain never imports drizzle
types. The repositories in `src/data/db/` pass drizzle's inferred rows straight to those mapping
functions with **no cast** — TypeScript checks the two shapes are compatible at that call. Renaming,
retyping or changing the nullability of a column the domain reads is therefore a compile error at the
repository line, not a runtime surprise. Never reintroduce `rows[0] as XRow`: it does not fix a type
mismatch, it hides one.

## Candidates under review (not yet seams)

These native modules are used in more than one place and would each become a seam once
consolidated behind a single wrapper directory. Registering them now would fail the test;
consolidating them is a separate, device-verified refactor.

- **`@react-native-async-storage/async-storage`** — `src/store/mapStore.ts`,
  `src/settings/preferencesStore.ts`. Natural boundary: a small persisted-preferences wrapper.
- **`expo-file-system`** — `src/data/trails/gpx/readFile.ts`, `src/map/offline/diskSpace.ts`,
  `src/map/providers/mapbox/useOverviewFile.ts`. Three unrelated uses (reading a picked file;
  reading free disk space; writing the overview's GeoJSON files for the map SDK to read), so the
  natural boundary is less obvious than the others — possibly thin wrappers rather than one.

## Related checks

The same `src/architecture/` scanner backs two sibling invariants: `secrets.test.ts` (no
token literals in source; `.env` gitignored) and `cycles.test.ts` (no circular imports). Add
new whole-codebase structural checks here, in the same style.
