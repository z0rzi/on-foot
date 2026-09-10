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

**`empty`** — there is a `<gpx>` root, but zero non-empty segments. Thrown where `nonEmpty` is
computed, so it covers `<gpx></gpx>`, an empty `<trkseg>`, and a waypoints-only file.

The boundary between the two was checked: `<gpx></gpx>` parses to `gpx: ""`, an empty *but
present* root, so it lands in `empty` rather than `format`.

### The screen names the actual issue

```ts
} catch (err) {
  if (cancelled) return
  setLoading(false)
  if (err instanceof GpxError && err.reason === 'empty') {
    Alert.alert('No route found', 'This GPX file has no route or track points to import.')
  } else {
    Alert.alert('Not a GPX file', 'This file could not be read as GPX.')
  }
  router.back()
}
```

Two messages, split on the issue the user can act on: the file is the wrong kind of file, or it
is the right kind and carries nothing to import.

A genuine `readGpxFile` failure — a missing file, a permission error — lands in the `else`
branch, and "could not be read as GPX" is honest for that case as well as for non-GPX content.
That is why it needs no third message. It is also close to unreachable: the file was just
picked or shared.

The alert renders over the trails list after `router.back()`, matching how
`OfflineLayerChooser`'s "Cannot download" already behaves.

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
- **On a cold-start "Open with" (`app/+native-intent.ts`), `/trail/new` is the only route on the
  stack, so the `router.back()` after the alert is a no-op and the screen stays on its spinner.**
  The dead end is pre-existing and affects the success path identically (`TrailForm` calls
  `router.back()` after saving), so it is not a regression of this change and is left for a
  backlog item of its own — but on that one path the user is now told what is wrong and still
  stranded.

## Test plan (Jest, written first)

`src/data/trails/__tests__/parse.test.ts` — assert the `reason`, not merely that it throws:

- plain text that is not XML → `format`
- JSON → `format`
- an empty string → `format`
- `<gpx></gpx>` → `empty`
- a track whose `<trkseg>` is empty → `empty`
- a document with only `<wpt>` waypoints → `empty`
- the existing missing-lat/lon case, tightened from `.toThrow()` to `format`

The seven existing tests stay green unchanged: every fixture, `METADATA_ONLY` and `NO_NAMES`
included, carries a real `trkpt`.

`app/trail/new.tsx` gains no test. The React Native testing library was removed in `a8e4793`,
and this repo's rule is that pure logic is TDD'd while rendering is device-verified. The
decision being changed is the parser's, and that is where it is pinned.

## Device verification

- Import a text file renamed to `.gpx` → "Not a GPX file", returned to the trails list.
- Import a GPX whose `<trkseg>` is empty → "No route found", returned to the trails list.
- Import a normal GPX, by picker and by Android share → unchanged: the form opens with the
  right name and metrics.
