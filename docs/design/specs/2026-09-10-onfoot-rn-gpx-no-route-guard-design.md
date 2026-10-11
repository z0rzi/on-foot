# GPX Import Rejects a File With No Route — Design

**Status:** Approved design
**Branch:** `fix/gpx-no-route-guard`
**Date:** 2026-09-10

## Goal

Resolve **ERR-2** and **TEST-2** from `docs/reviews/2026-09-10-full-review.md`: stop letting a
file with no usable route become a saveable trail, and stop failing silently when a file cannot
be read.

`parseGpx` returns `segments: []` rather than failing when a document has no route or track
points, and `app/trail/new.tsx:31-37` never checks the result. So `metricsForSegments([])`
reads `0 m / —`, the form renders, and "I'm done" persists a trail with no route. Every
downstream consumer then degrades quietly — `MapCanvas` `hasTrail` is false, the offline
chooser says "Cannot download" — so the user gets a trail that does nothing and was never told
why. The `catch` at `new.tsx:38-43` is the same defect from the other side: it `router.back()`s
on a read or parse failure with no message at all.

Verified against the app's own parser options rather than assumed: `'hello world, not xml at
all'`, `''` and `'{"json":true}'` all parse to `{}` with no throw, and
`<gpx><trk><trkseg></trkseg></trk></gpx>` yields no points either. Every case the finding
claims is real.

## Existing shape

The closest existing shape is **`parseGpx`'s own `requireCoord`**, which already fails a
malformed document by throwing. This change extends that existing failure mode rather than
introducing a second one; a `Result`/tagged-return would have forked the file's error handling
in two, and there is no such pattern anywhere in the data layer to follow.

There is **no second instance to extract**. `parseGpx` has exactly one call site
(`app/trail/new.tsx`): all three entry points converge on it — the document picker in
`app/(tabs)/trails.tsx:66-73` and the Android share intent via `src/trails/useIncomingShare.ts`
both `router.push('/trail/new')`, and a cold-start "Open with" is redirected there by
`redirectSystemPath` in `app/+native-intent.ts:1-6` — so the guard exists once, at the source,
and every future consumer inherits it.

The alert shape follows the codebase's existing two-argument informational alerts
(`OfflineLayerChooser.tsx:90`, `TrailForm.tsx:56`): title, one sentence, no buttons.

## Scope

- `src/data/trails/gpx/parse.ts` — the error type and the two guards.
- `app/trail/new.tsx` — map the failure to one of two alerts instead of a silent `back()`.
- `src/data/trails/__tests__/parse.test.ts` — TEST-2 and its siblings.

**Out of scope:** ERR-3 (the `void load().then()` chains, including the one in this screen's
sibling hooks) and the `useLoadedEntity` extraction it depends on; the read/parse error surface
of any other screen.

## The change

### One failure vocabulary for the parser

```ts
export type GpxFailure = 'format' | 'empty'

export class GpxError extends Error {
  constructor(readonly reason: GpxFailure, message: string) { super(message) }
}
```

One class carrying a `reason` union, not two classes: the parser's whole failure vocabulary
stays in one place, and a third reason later adds no new export. Every throw in the file is a
bare `Error` today, so this establishes the pattern rather than forking one.

**`format`** — the document has no `<gpx>` root: plain text, JSON, or XML that is not GPX. The
`?.gpx ?? {}` at `parse.ts:57` is precisely what swallows this today, so the `??` becomes an
explicit check. `requireCoord`'s existing missing-lat/lon throw becomes a `format` failure too:
a GPX whose points have no coordinates is malformed, not empty.

**`empty`** — there is a `<gpx>` root, but zero drawable segments. Thrown where `nonEmpty` is
computed, so it covers `<gpx></gpx>`, an empty `<trkseg>`, and a waypoints-only file.

The boundary between the two was checked: `<gpx></gpx>` parses to `gpx: ""`, an empty *but
present* root, so it lands in `empty` rather than `format`.

### A segment needs two points to be a route

A segment of one point draws nothing and contributes no distance, so the floor is two points,
applied per segment in both places a segment is judged:

- **The route filter** (`asArray(gpx.rte).filter((rte) => asArray(rte.rtept).length >= 2)`) —
  a `<rte>` with fewer than two `<rtept>`s does not count as a real route, so it no longer wins
  precedence over a `<trk>` in the same file and no longer suppresses it.
- **The segment filter** (`segments.filter((s) => s.length >= 2)`) — the same floor applied
  after routes/tracks are turned into segments, so a one-point `<trkseg>` (or a route that
  slipped past the first filter as part of a `<gpx>` with no track fallback) is dropped there
  too.

Both guards use the same floor deliberately: a route or track that cannot be drawn should not
be treated as present at either stage.

This is **stricter** than `src/map/MapCanvas.tsx:54`'s `hasTrail = pointCount(segments) >= 2`,
which aggregates the point count across *all* segments — two separate one-point segments would
satisfy `hasTrail` there. The parser's floor is per segment: two one-point segments are each
rejected here, deliberately, because neither could be drawn as a line on its own.

### The screen names the actual issue

```ts
} catch (err) {
  if (cancelled) return
  if (err instanceof GpxError && err.reason === 'empty') {
    Alert.alert('No route found', 'This GPX file has no route or track points to import.')
  } else {
    Alert.alert('Not a GPX file', 'This file could not be read as GPX.')
  }
  leave()
  return
}
```

The `try` wraps only the read and the parse, so a fault in `metricsForSegments` or in a state
setter is not reported as a bad file. `leave()` is the screen's exit, described under
"Consequences accepted".

Two messages, split on the issue the user can act on: the file is the wrong kind of file, or it
is the right kind and carries nothing to import.

A genuine `readGpxFile` failure — a missing file, a permission error — lands in the `else`
branch, and "could not be read as GPX" is honest for that case as well as for non-GPX content.
That is why it needs no third message. It is also close to unreachable: the file was just
picked or shared.

The alert's two-argument title-and-sentence shape follows `OfflineLayerChooser.tsx:90` and
`TrailForm.tsx:48`. Raising an alert and leaving the screen in the same breath has no prior art
here — `OfflineLayerChooser` alerts and returns without navigating — so whether the native
dialog survives the navigation is the one behaviour in this change that only device
verification can settle.

## Rejected alternatives

**Guard in `new.tsx` instead of the parser** (`if (parsed.segments.length === 0) ...`). Smaller
diff, but it leaves `parseGpx` returning a value that is structurally valid and semantically
useless, so the next consumer re-learns the check or forgets it. The review says fix at the
source, and with a single call site the cost of doing so is the same.

**A tagged failure result** (`{ ok: false, reason }`). Would force the sole consumer to branch
two ways for what is one user-facing outcome, and would fork the file's error handling: the
coordinate guard already throws.

**Distinguishing read failure from parse failure by splitting the two `await`s into separate
`try` blocks.** More precise about which stage failed, but that is not the distinction the user
can act on — "not a GPX file" and "no route in it" are, and both are content failures decided
by the parser.

## Consequences accepted

- **A waypoints-only GPX can no longer be imported.** It has no route to draw, gives 0 m of
  metrics, leaves `hasTrail` false and cannot be downloaded offline — it is exactly the broken
  trail ERR-2 describes. Rejecting it is the point, not a side effect.
- **`parseGpx` now throws where it used to return.** Its one call site already has a `catch`,
  and every existing test fixture carries a real `trkpt`, so nothing else changes behaviour.
- **A malformed file still costs a full read and parse before the message.** Correct: there is
  no way to know a file is unusable without reading it.
- **A `<rte>` element carrying no points no longer suppresses a file's `<trk>` geometry.**
  Route-vs-track precedence is decided by routes that actually carry points, so route metadata
  alongside a real track imports the track instead of being rejected as empty.
- **A single-point route or track is now rejected outright.** A file whose only geometry is one
  `<rtept>` or one `<trkpt>` used to slip through as a one-point segment; it now fails as
  `empty`, a user-visible rejection ("No route found") that did not previously happen.
- **A one-point segment inside an otherwise valid multi-segment file is dropped silently.** If
  one segment of a multi-segment track (or one route among several) has only one point, it is
  filtered out while its siblings import normally — no error, no partial-import notice. This
  costs nothing numerically (a lone point contributes no distance and no elevation delta), but
  it is real, undocumented-elsewhere behaviour: the user is not told a segment was dropped.
- **On a cold-start "Open with" (`app/+native-intent.ts`), `/trail/new` is the only route on the
  stack, so a bare `router.back()` is a no-op and would leave the user on the spinner.** Every
  exit from the trail form now goes through the shared `useGoBackOrHome(fallback)` hook, which
  falls back to a caller-chosen route instead of stranding the user on the spinner when there is
  no history to pop. `TrailForm` renders neither navigation nor navigation chrome — no
  `Stack.Screen`, no header back button — and takes no `onBack`/`title` prop; each host screen
  (`app/trail/new.tsx`, `app/trail/[id]/edit.tsx`) owns its own `Stack.Screen`, header, and back
  button, wired to that screen's own `leave`. A successful import lands on `/trails` when the
  screen was entered cold (picker or "Open with"); a *warm* share intent
  (`src/trails/useIncomingShare.ts` pushes `/trail/new` while the user is elsewhere in the app)
  has history behind it, so `leave()` pops back to wherever the user was instead. A successful
  edit likewise returns wherever the user came from. `app/settings/offline.tsx` was pulled into
  this feature's scope: it now uses both `useGoBackOrHome` and `ScreenHeader`, so there is no
  remaining unguarded exit. `ActivityForm` and its host `app/activity/save.tsx` follow the same
  split, so the pair stays aligned. Carrying neither navigation nor its chrome is what lets
  `TrailForm` later be hosted on the map screen for a live preview, where there is no stack
  header at all.
- **Navigation chrome was extracted into `src/components/ScreenHeader.tsx`.** The same
  `Stack.Screen` header-with-back-button block appeared in three screens once navigation chrome
  moved out of the form components; the duplication gate caught the repetition, and rather than
  add a `DUPLICATION_EXEMPT` entry the shared shape became `ScreenHeader`. `onBack` is optional
  on it — rendering `headerLeft` only when provided — so `app/activity/save.tsx`, whose screen
  deliberately has no back button (the user must Save or Discard), can use it too without a
  different call shape. All four header sites (`app/trail/new.tsx`, `app/trail/[id]/edit.tsx`,
  `app/settings/offline.tsx`, `app/activity/save.tsx`) now use `ScreenHeader`, and
  `DUPLICATION_EXEMPT` is back to the empty array it was before this branch.
- **A successful import no longer selects the imported trail on the map.** The trails list is the
  confirmation instead: the new row is visible there, and tapping it reaches the map with the
  trail framed.

## Test plan (Jest, written first)

`src/data/trails/__tests__/parse.test.ts` — assert the `reason`, not merely that it throws:

- plain text that is not XML → `format`
- JSON → `format`
- an empty string → `format`
- `<gpx></gpx>` → `empty`
- a track whose `<trkseg>` is empty → `empty`
- a document with only `<wpt>` waypoints → `empty`
- the existing missing-lat/lon case, tightened from `.toThrow()` to `format`

The seven existing tests stay green, but not unchanged: raising the floor to two points meant
five fixtures (`NAMESPACED`, `METADATA_ONLY`, `NO_NAMES`, `MULTI_SEG`, `MULTI_RTE`) each gained
a second point, since a single-`trkpt`/`rtept` fixture would now fail with `empty` instead of
exercising what its test names. Each test still proves what its name claims once its fixture
carries two points.

`app/trail/new.tsx` gains no test. The React Native testing library was removed in `a8e4793`,
and this repo's rule is that pure logic is TDD'd while rendering is device-verified. The
decision being changed is the parser's, and that is where it is pinned.

## Device verification

- Import a text file renamed to `.gpx` → "Not a GPX file", returned to the trails list.
- Import a GPX whose `<trkseg>` is empty → "No route found", returned to the trails list.
- Import a normal GPX, by picker and by Android share → unchanged: the form opens with the
  right name and metrics.
