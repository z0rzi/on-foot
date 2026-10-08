# Duplication sweep: DUP-1, DUP-5, DUP-7, DUP-11

Four independent duplication findings, grouped because each is small, each is provable without a
device, and each is the same kind of defect: **one idea with two implementations**.

## Scope and why these four

The owner asked for the DOC and DUP findings that can be completed in autonomy, with no device
available. Taken:

| Finding | Shape | Why it is safe without a device |
| --- | --- | --- |
| **DUP-1** (should-fix) | Bounding box computed twice, `{ne,sw}` declared twice | Both sides already have unit tests |
| **DUP-5** (minor) | Two theme tokens for one role | Dark values are identical; only a one-shade light change on one label |
| **DUP-7** (minor) | Filter-then-assert on `parsePackId`, five `!` | Pure logic, behaviour-identical, covered by three suites |
| **DUP-11** (minor) | The trails/activities formatter mirror diverges | Rename is mechanical; separator argued below |

Not taken, with reasons:

- **DUP-6** is recorded as **accept** ("extract only if a third entity store appears"). The correct
  action is none. Touching it would be inventing work the finding explicitly declined.
- **DUP-9** (the port's two route-line components) changes what is drawn during a recording. Its
  whole point is a visible disagreement between map and graph, so it cannot be verified without a
  device.
- **DUP-10** (a `source` discriminator on `RouteDisplay`) is a design call on the map rendering path,
  needing a device pass across every mode. The finding already records that the two functions agree
  today.
- **DOC-5** is a pointer to **ARCH-4**, and ARCH-4 has two mutually exclusive resolutions: gate the
  offline entry points on `caps.offline`, or delete the flag as dead (**DEAD-1**). Choosing either
  forecloses the other, both are ARCH scope rather than DOC, and the "gate it" branch changes runtime
  behaviour for a provider that cannot be swapped in here. Left for the owner.

## Existing shape

Each change has a first instance already in the codebase, and follows it rather than inventing:

- **DUP-1** → `src/map/geo.ts` already owns the shared map-geometry helpers (`toLineCoordinates`,
  `segmentLines`, `flattenSegments`). `boundsForPoints` lives there; the duplicate lives one
  directory down in `offline/`. The shared thing moves *up* to the existing shared module, which is
  what the finding asks for ("one exported `LngLatBounds` in `map/geo.ts`").
- **DUP-5** → `controlContent` is already the token the four sibling icons in the same control
  cluster use. Nothing is extracted; one outlier joins the existing convention.
- **DUP-7** → `src/map/offline/packId.ts` already owns pack-id parsing (`packId`, `parsePackId`).
  The new helper is the third function in that module, not a new one.
- **DUP-11** → `src/activities/format.ts` is the first instance of the pair, and
  `trails/difficulty.ts` / `activities/effort.ts` is the naming precedent the finding cites: each
  names its domain. Nothing is extracted to be shared — the two modules format different types, and
  both already delegate the unit formatting to `src/format/units.ts`. The divergence is naming, not
  logic.

## DUP-1 — one bounding box, one bounds type

`boundsForTrail` is `boundsForPoints` plus a margin. Target:

```ts
export function boundsForTrail(points, marginKm) {
  return expand(boundsForPoints(points), marginKm)
}
```

`boundsForPoints` widens its parameter from `GpxPoint[]` to `{ lat: number; lng: number }[]` — every
`GpxPoint` is assignable, so no caller changes — and returns the named `LngLatBounds`, which moves
from `src/map/offline/types.ts` to `src/map/geo.ts` and is re-exported nowhere. The four offline
modules that use the type import it from `../geo`.

`expand` stays private to `bounds.ts`: it is the only margin logic in the app, and exporting it would
invite a second caller to re-derive the margin convention.

## DUP-5 — delete the token with one consumer

`controlsText` exists at three places in `src/theme/colors.ts` (the type field, light `#000000`, dark
`#FFFFFF`) and is read once, by the 2D/3D label. Its four siblings in the same cluster use
`controlContent` (light `#1C1B1F`, dark `#FFFFFF`).

In dark theme the two are **identical**, so nothing changes. In light theme one small label moves
from pure black to `#1C1B1F` — the shade its four neighbours already use, which is the point.

The previous report named `controlsText` as the plausible-sounding token that shipped black-on-blue.
Deleting it removes the trap, not just the duplicate.

## DUP-7 — parse the pack id once

Every site does the same two-step: filter by `parsePackId(x)?.trailId === trailId`, then reach for
`parsePackId(x)!.styleId` — parsing twice and asserting non-null on the second parse, five times.

A third function in `packId.ts` keeps the parse result instead of throwing it away:

```ts
export function packsForTrail<T extends { id: string }>(
  items: T[],
  trailId: number,
): { pack: T; styleId: string }[]
```

Generic over `{ id: string }` because the callers hold two shapes: `OfflinePackInfo[]` from the
registry, and live-progress entries keyed by id. `badge.ts` turns its `Record<string, LiveProgress>`
into `{ id, ...progress }` objects once, and then both shapes flow through the same helper.

This is behaviour-preserving by construction: the predicate and the extracted field are unchanged.
The five `!` assertions go away because the value was never actually optional at that point — the
filter had already proven it.

## DUP-11 — make the mirror a mirror

Two differences, both fixed:

1. **`formatMetricsSummary` → `formatTrailSummary`.** The sibling is `formatActivitySummary`, and the
   naming precedent (`trails/difficulty.ts` / `activities/effort.ts`) names by domain. "Metrics" is
   the noun `data/geo` used before the formatter moved out; it no longer says which domain it
   summarises. Three call sites and one test file.

2. **Separator `•` (U+2022) → `·` (U+00B7).** Both list items render through the *same*
   `EntityListItem` component via its `lines` prop, so the two separators appear in identical
   typography. `·` is the app's majority convention: `formatActivitySummary` uses it, and so does
   the elevation graph's scrub readout (`2037 m · 6.3 km · -2%`, confirmed on device 2026-10-08).
   Trails is the single outlier.

The finding says the separator change "needs a device check". That caveat was written when the
shipped alternative was unknown; it is now evidence rather than a question, because `·` already ships
in the identical component. Still worth a glance at the next device pass, and the review documents
will say so rather than claim it was verified.

## Testing

Everything here is pure logic with existing coverage. No new behaviour, so the tests prove
*preservation*:

- **DUP-1** — `src/map/__tests__/geo.test.ts` and `src/map/offline/__tests__/bounds.test.ts` both
  exist and must pass unchanged, except where a test names the moved type. A new case pins the one
  genuinely new claim: `boundsForTrail` with `marginKm: 0` equals `boundsForPoints` exactly.
- **DUP-5** — no test; the proof is that `controlsText` has zero references repo-wide afterwards.
- **DUP-7** — `badge.test.ts`, `operations.test.ts` and `packId.test.ts` must pass unchanged. New
  cases for `packsForTrail`: a matching trail, a non-matching trail, and an unparseable id.
- **DUP-11** — `src/trails/__tests__/format.test.ts` updates to the new name and the new separator.

Expected: **70 suites / 577 tests** before, and more after — the exact count is derived during
implementation, not predicted here.

## Out of scope

- No change to `parsePackId` itself, to `EntityListItem`, or to any formatter in `src/format/units.ts`.
- `expand` is not exported.
- The `·`/`•` choice is not applied to anything outside `src/trails/format.ts`.
