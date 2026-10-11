# Move the presentation formatters out of the data layer (backlog item 8)

Closes **ARCH-1**. Closes the `formatBytes` half of **TEST-1** (see "Partial closure" below).

## Problem

`src/data/geo/metrics.ts:71-84` defines `formatDistance`, `formatElevation` and
`formatMetricsSummary` — three functions whose entire job is to produce strings for the screen,
including the UI copy `'—'` and `'no elevation data'`. `POST-WORK.md:65` states the rule they break:

> Layering: presentation logic (formatters, view helpers) shouldn't live in the data layer.

Eight files import them from `data/geo`, one of which is `src/activities/format.ts` — a presentation
module reaching *down* into the data layer for a formatter. Separately,
`src/map/offline/format.ts` holds `formatBytes`, a fourth unit formatter, in a third place, with no
test despite three unit boundaries, a clamp, and three user-facing call sites.

The deeper problem is not location but organisation: the two formatter modules are split **by layer**
(data vs activities) rather than **by role** (units vs domain summaries), so where a formatter lives
tells you nothing about what it does.

## Existing shape

The closest existing feature of the same shape is **`src/activities/format.ts`**: a presentation
module that turns domain metrics into display strings, holding `formatActivitySummary(metrics:
ActivityMetrics)` alongside duration, pace and clock helpers. It is the pattern to copy — and it is
also the file that demonstrates the defect, since line 2 imports `formatDistance` from the data layer.

Reused from it: its role (presentation-only), its `format*` naming, and its structure. What is
extracted to be shared: the unit formatters themselves, which both the trail and activity sides need
and neither should own.

## Design

Two destinations, chosen by **role**:

### `src/format/units.ts` (new) — pure unit → string

`formatDistance`, `formatElevation`, `formatBytes`. These take numbers and return strings. They
reference no domain type, so they belong to neither trails nor activities, and both may use them.

### `src/trails/format.ts` (new) — trail-domain summary

`formatMetricsSummary(metrics: TrailMetrics)`. It takes a domain type and composes unit formatters
into one line.

**Why this differs from what ARCH-1 proposed.** The finding suggested putting all three in
`src/format/units.ts`. That would leave `formatMetricsSummary` (trail domain) in a units module while
its exact counterpart `formatActivitySummary` (activity domain) stays in `activities/format.ts` —
preserving the asymmetry that ARCH-1 itself identifies as the real defect. Splitting by role instead
makes the two sides mirror images:

| | units | domain summary |
|---|---|---|
| trails | `format/units.ts` | `trails/format.ts` → `formatMetricsSummary` |
| activities | `format/units.ts` | `activities/format.ts` → `formatActivitySummary` |

`src/trails/` already hosts trail presentation helpers (`difficulty.ts`), so the file has a home.

### `src/map/offline/format.ts` is deleted

`formatBytes` moves to `src/format/units.ts`. Nothing in it is about maps or offline packs; it is a
unit formatter that happened to be defined next to its first caller.

### A gate, so it cannot come back

`src/architecture/importRules.ts` already enforces one layering rule of exactly this kind. Add a
second:

```ts
{
  within: 'src/data/',
  mustNotImport: 'format/units',
  rationale:
    'The data layer computes and persists; turning values into strings for the screen is presentation. '
    + 'Formatters living in data/geo is what ARCH-1 was.',
}
```

Without it, the move is a one-time tidy that the next session can silently undo. With it, the
layering is structural. This is an addition to what ARCH-1 asked for, made deliberately.

## Behaviour

**Nothing on screen changes.** Every function body is moved verbatim; no string, rounding or
threshold is touched. This is a pure relocation plus new tests.

## Testing

The gate covers this change completely — there is nothing here that needs a device, which is why it
was chosen for an unattended session.

- `src/format/__tests__/units.test.ts` (new): the three `formatDistance`/`formatElevation` tests move
  here from `data/geo/__tests__/metrics.test.ts`, plus **new** `formatBytes` tests covering its three
  unit boundaries (GB ≥ 1e9, MB ≥ 1e6, KB below) and the `Math.max(1, …)` clamp that stops a tiny
  pack reading as `0 KB`.
- `src/trails/__tests__/format.test.ts` (new): the two `formatMetricsSummary` tests move here.
- `src/data/geo/__tests__/metrics.test.ts`: those five tests and their imports are removed; its
  `haversineMeters`/`computeMetrics`/`metricsForSegments` coverage stays untouched.
- The `importRules` test gains the new rule automatically — it iterates `IMPORT_RULES`.

Expected after the change: **69 suites / 570 tests** — the 566 existing tests (five of them
relocated between files, which changes no count) plus 4 new ones for `formatBytes`. Two new suites,
and `metrics.test.ts` survives because its `haversineMeters`/`computeMetrics` coverage stays.

## Consumers

Eleven import sites, all mechanical:

| File | Takes from `data/geo/metrics` today | After |
|---|---|---|
| `src/activities/ActivityForm.tsx` | distance, elevation | `../format/units` |
| `src/activities/format.ts` | distance | `../format/units` |
| `src/elevation/ElevationGraph.tsx` | distance, elevation | `../format/units` |
| `src/map/ActivityInfoSheet.tsx` | distance, elevation | `../format/units` |
| `src/recording/RecordingInfoSheet.tsx` | **`metricsForSegments`** + distance, elevation | split: keep `metricsForSegments` on `data/geo/metrics`, formatters from `../format/units` |
| `src/trails/TrailForm.tsx` | distance, elevation | `../format/units` |
| `src/trails/TrailInfoSheet.tsx` | distance, elevation, **summary** | split: `../format/units` + `./format` |
| `src/trails/TrailListItem.tsx` | summary | `./format` |
| `src/map/offline/OfflineMapsList.tsx` | (`./format` → `formatBytes`) | `../../format/units` |
| `src/map/offline/downloadConsent.ts` | (`./format` → `formatBytes`) | `../../format/units` |
| `src/map/offline/OfflineLayerChooser.tsx` | (`./format` → `formatBytes`) | `../../format/units` |

Two of the eleven are **not** whole-line replacements — `RecordingInfoSheet` and `TrailInfoSheet`
each keep an import of something that is not moving. Those are the two places a careless
search-and-replace breaks the build.

## Partial closure, stated honestly

**TEST-1 is only half closed.** Its text also names `packDescriptor` (trivial) and lifting
`guardDownload`'s decision order into a pure `downloadDecision(status, freeBytes, estimate)`. Neither
is touched here: the first is not worth a test, and the second is a refactor of Alert-bound logic,
not a formatter move. TEST-1 stays open with its `formatBytes` clause marked done.

## Out of scope

- `src/activities/format.ts` does not move. Its contents are correctly placed already; only its
  import of `formatDistance` is repointed.
- No formatter body is edited, renamed, or given new behaviour.
