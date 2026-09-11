# GPX No-Route Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a GPX file with no usable route fail at the parser instead of becoming a saveable
empty trail, and replace the new-trail screen's silent `router.back()` with a message that names
the actual problem.

**Architecture:** One exported `GpxError` carrying a `reason: 'format' | 'empty'` gives
`parseGpx` a failure vocabulary; the parser throws it where it currently returns an empty result
(no `<gpx>` root → `format`; a root with zero non-empty segments → `empty`) and reuses it for the
existing missing-coordinate throw. `app/trail/new.tsx`, the parser's only call site, maps the
reason to one of two alerts. Spec: `docs/superpowers/specs/2026-09-10-onfoot-rn-gpx-no-route-guard-design.md`.

**Tech Stack:** TypeScript ~6.0.3 (strict, `target: ESNext`, Babel/Hermes — native classes, so
`instanceof` on an `Error` subclass is reliable), `fast-xml-parser`, Jest 29 via `jest-expo`,
React Native `Alert`, expo-router.

## Global Constraints

- **`npm run verify` must be green** after every task (tsc, jest, expo lint, seams/secrets/cycles/duplication).
- **Pure logic is TDD'd; rendering is device-verified** (AGENTS.md). `parseGpx` is pure → tests
  first, watched fail. `app/trail/new.tsx` is a screen and gets no test: the React Native testing
  library was removed in `a8e4793`.
- **Comment policy (AGENTS.md):** describe current state, never the change. No change-narrating
  comments anywhere in this work.
- **No new npm dependency.**
- **Commit style:** `type(scope): lowercase subject`, one sentence, no body, no trailing period.
- **Alert copy is fixed by the spec** — use these four strings verbatim:
  - `'No route found'` / `'This GPX file has no route or track points to import.'`
  - `'Not a GPX file'` / `'This file could not be read as GPX.'`
- **Existing behaviour that must not change:** the seven current tests in
  `src/data/trails/__tests__/parse.test.ts` stay green untouched except the one noted in Task 1
  Step 1; every fixture there carries a real `trkpt`.

---

### Task 1: `parseGpx` rejects a document with no route

**Files:**
- Modify: `src/data/trails/gpx/parse.ts:36-78`
- Test: `src/data/trails/__tests__/parse.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `export type GpxFailure = 'format' | 'empty'` and
  `export class GpxError extends Error { readonly reason: GpxFailure }`, both from
  `src/data/trails/gpx/parse.ts`. `parseGpx(xml: string, fallbackName?: string | null): GpxParseResult`
  keeps its signature but now throws `GpxError` instead of returning `{ segments: [], ... }`.

- [ ] **Step 1: Write the failing tests**

Append to `src/data/trails/__tests__/parse.test.ts`, and add `GpxError` to the existing import
on line 1 so it reads `import { GpxError, parseGpx } from '../gpx/parse'`:

```ts
const EMPTY_ROOT = `<?xml version="1.0"?><gpx></gpx>`

const EMPTY_SEG = `<?xml version="1.0"?>
<gpx><trk><name>No Points</name><trkseg></trkseg></trk></gpx>`

const WAYPOINTS_ONLY = `<?xml version="1.0"?>
<gpx><wpt lat="1.0" lon="2.0"><name>WP</name></wpt></gpx>`

function reasonOf(xml: string): string {
  try {
    parseGpx(xml)
  } catch (err) {
    return err instanceof GpxError ? err.reason : `not a GpxError: ${String(err)}`
  }
  return 'did not throw'
}

test('a document with no gpx root is a format failure', () => {
  expect(reasonOf('hello world, not xml at all')).toBe('format')
  expect(reasonOf('{"json":true}')).toBe('format')
  expect(reasonOf('')).toBe('format')
})

test('a gpx root with no route or track points is an empty failure', () => {
  expect(reasonOf(EMPTY_ROOT)).toBe('empty')
  expect(reasonOf(EMPTY_SEG)).toBe('empty')
})

test('a waypoints-only file has no route to import', () => {
  expect(reasonOf(WAYPOINTS_ONLY)).toBe('empty')
})
```

And replace the existing missing-lat/lon test (currently `expect(() => parseGpx(MISSING_LAT)).toThrow()`)
with the tightened version:

```ts
test('a point missing lat or lon is a format failure', () => {
  expect(reasonOf(MISSING_LAT)).toBe('format')
})
```

Why these assert the reason rather than `.toThrow()`: the screen branches on `reason`, so a test
that only proves "it throws" would pass even if every failure collapsed into one reason and the
user got the wrong message. `reasonOf` returns a describing string rather than throwing itself so
a wrong outcome reads as `Expected "empty", Received "format"` instead of an unhandled error.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/data/trails/__tests__/parse.test.ts`

Expected: the three new tests FAIL with `Received: "did not throw"` (the parser returns an empty
result today), and the tightened missing-lat/lon test FAILS with
`Received: "not a GpxError: Error: GPX point missing lat/lon"`. The other six tests PASS.

If a new test errors on `GpxError is not defined` instead, the import in Step 1 was missed — fix
and re-run until the failure is the one described above.

- [ ] **Step 3: Add the error type**

In `src/data/trails/gpx/parse.ts`, directly below the `GpxParseResult` interface:

```ts
export type GpxFailure = 'format' | 'empty'

export class GpxError extends Error {
  constructor(readonly reason: GpxFailure, message: string) {
    super(message)
  }
}
```

- [ ] **Step 4: Throw it from the two guards**

In `requireCoord`, replace the bare throw:

```ts
  if (lat === null || lng === null) throw new GpxError('format', `GPX ${kind} missing lat/lon`)
```

In `parseGpx`, replace line 57 (`const gpx = parser.parse(xml)?.gpx ?? {}`) with an explicit
presence check:

```ts
  const gpx = parser.parse(xml)?.gpx
  if (gpx === undefined || gpx === null) throw new GpxError('format', 'No <gpx> root element')
```

Use `=== undefined || === null`, matching `num()` and `str()` in this file — **not** `?? {}` and
not a truthiness check. `<gpx></gpx>` parses to `gpx: ""`, which is a present-but-empty root and
must reach the `empty` guard below, not this one.

Then, where `nonEmpty` is computed, fail instead of returning it empty:

```ts
  const nonEmpty = segments.filter((s) => s.length > 0)
  if (nonEmpty.length === 0) throw new GpxError('empty', 'GPX has no route or track points')
```

Place it immediately after the `nonEmpty` assignment, before the title lines — a document with no
points has no trail to name, so computing the title first would be wasted work.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest src/data/trails/__tests__/parse.test.ts`

Expected: all ten tests PASS, output clean. If `reasonOf` returns `not a GpxError: ...`, the
`instanceof` failed — check that `GpxError` is imported from the same module the parser throws
from, not redeclared in the test.

- [ ] **Step 6: Full verify**

Run: `npm run verify`

Expected: exit 0. `app/trail/new.tsx` still compiles — it catches with a bare `catch {}`, so the
new throw type does not break types yet; its behaviour is Task 2.

- [ ] **Step 7: Commit**

```bash
git add src/data/trails/gpx/parse.ts src/data/trails/__tests__/parse.test.ts
git commit -m "fix(gpx): reject a file with no gpx root or no route points"
```

---

### Task 2: The new-trail screen names the failure

**Files:**
- Modify: `app/trail/new.tsx:1-46`
- Test: none — see Global Constraints (screen; device-verified).

**Interfaces:**
- Consumes: `GpxError` and its `reason` field from Task 1 (`src/data/trails/gpx/parse.ts`).
- Produces: nothing other tasks depend on.

- [ ] **Step 1: Import the error type**

In `app/trail/new.tsx`, widen the existing parse import on line 5:

```ts
import { GpxError, parseGpx } from '../../src/data/trails/gpx/parse'
```

Add `Alert` to the existing `react-native` import on line 2:

```ts
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native'
```

- [ ] **Step 2: Replace the silent catch**

Replace the current block (`} catch { if (!cancelled) { setLoading(false); router.back() } }`) with:

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

**As shipped, this step went further than written here:** the `try` was narrowed to the read and
the parse alone, and the exit became `leave()` — `router.canGoBack() ? router.back() :
router.replace('/')` — after review. See the spec's "Consequences accepted".

The `else` branch is also where a `readGpxFile` failure lands — a missing file or a permission
error — and "could not be read as GPX" is honest for that case too, which is why there is no
third message. Keep the `if (cancelled) return` guard first: a screen that has already unmounted
must not raise an alert.

Do not add a comment explaining any of the above in the source — that is change narration
(AGENTS.md). This paragraph exists in the plan and the spec, not in `new.tsx`.

- [ ] **Step 3: Verify**

Run: `npm run verify`

Expected: exit 0. In particular `expo lint` must not report an unused `err` — it is used by the
`instanceof` check.

- [ ] **Step 4: Commit**

```bash
git add app/trail/new.tsx
git commit -m "fix(trails): tell the user why a gpx import failed instead of going back silently"
```

- [ ] **Step 5: Device verification (hand to the user — do not claim this yourself)**

Ask the user to confirm on-device:

1. Import a plain text file renamed to `.gpx` → alert **"Not a GPX file"**, returned to the trails list.
2. Import a GPX whose `<trkseg>` is empty → alert **"No route found"**, returned to the trails list.
3. Import a normal GPX via the picker → unchanged: the form opens with the right name and metrics.
4. Import a normal GPX via the Android share sheet → same as 3, since all entry paths route through this screen.
5. Cold-start "Open with": kill the app, long-press a corrupt `.gpx` in a file manager and open it with On Foot → alert **"Not a GPX file"**, then the trails list. This path starts with no history to pop, so it exercises the `canGoBack` fallback; confirm you are not left on the spinner.
6. Cold-start "Open with" a *valid* GPX (e.g. opening a file from Telegram) → the form appears; submitting once lands on the trails list with exactly one new trail, and pressing submit repeatedly is impossible because the button disables on success.

---

### Task 3: Record the outcome in the review

**Files:**
- Modify: `docs/reviews/2026-09-10-full-review.md` (the `**Progress.**` paragraph in the header, backlog row 2, and the ERR-2 and TEST-2 finding entries)

**Interfaces:**
- Consumes: the two commit SHAs from Tasks 1 and 2.
- Produces: nothing.

**Only after the user confirms Task 2 Step 5.** The report is a snapshot of commit `9833610`;
annotate it in place rather than rewriting it, matching exactly how backlog item 1 was ticked:

- [ ] **Step 1: Extend the `**Progress.**` paragraph** in the header with backlog item 2 and its SHAs.

- [ ] **Step 2: Strike through backlog row 2** and append `**done** — \`<sha1>\`, \`<sha2>\`` to it.

- [ ] **Step 3: Append `**Done** (\`<sha1>\`, \`<sha2>\`)` notes** in place to the ERR-2 and TEST-2
  entries in sections 3.4 and 3.5. ERR-2's note records that the fix rejects a waypoints-only
  file as well, which the finding did not enumerate.

- [ ] **Step 4: Commit**

```bash
git add docs/reviews/2026-09-10-full-review.md
git commit -m "docs(reviews): tick the gpx no-route guard as done"
```

---

## Self-review

**Spec coverage.** Error vocabulary → Task 1 Step 3. `format` guard (no root) → Step 4. `format`
reuse for missing coordinates → Step 4. `empty` guard → Step 4. Two alerts with the spec's exact
copy → Task 2 Step 2, strings pinned in Global Constraints. Waypoints-only rejection → Task 1
Step 1 (`WAYPOINTS_ONLY`). All seven test-plan cases → Task 1 Step 1. Device verification → Task 2
Step 5, all four spec bullets. Rejected alternatives need no task.

**Type consistency.** `GpxError` / `reason` / `'format'` / `'empty'` are spelled identically in
Task 1 Steps 1, 3, 4 and Task 2 Steps 1, 2. `reasonOf` is defined once, in the test file.

**Known-good boundary, already checked against `fast-xml-parser` with this app's parser options:**
`'hello world'`, `''` and `'{"json":true}'` → `{}` (no root → `format`); `<gpx></gpx>` → `gpx: ""`
(present root → falls through to `empty`); `<gpx><trk><trkseg></trkseg></trk></gpx>` → no points
(→ `empty`).

## Record: what was actually built, beyond this plan

**The two-point floor.** Task 1 as written stopped at "zero non-empty segments" (`s.length > 0`).
A follow-up commit on this branch raised both guards' floor to two points: the route filter
(`asArray(rte.rtept).length >= 2`, was `> 0`) and the segment filter (`s.length >= 2`, was
`> 0`). A segment of one point draws nothing and contributes no distance, so a `<rte>` or
`<trkseg>` carrying exactly one point is now rejected the same way an empty one is — including
a one-point `<rte>` that would otherwise have won precedence over a real `<trk>` and suppressed
it. Five existing fixtures (`NAMESPACED`, `METADATA_ONLY`, `NO_NAMES`, `MULTI_SEG`, `MULTI_RTE`)
needed a second point added to keep exercising what their test names claim, and one new test,
`a route with too few points to draw does not suppress the track`, pins the precedence case.
See the design doc's "A segment needs two points to be a route" section and its comparison
against `src/map/MapCanvas.tsx:54`'s aggregate `hasTrail` check.

**The `ScreenHeader` extraction.** The `Stack.Screen` header-with-back-button block this plan
has each of `app/trail/new.tsx` and `app/trail/[id]/edit.tsx` own inline (Task 1's spec
reference, "Consequences accepted") also appeared in `app/settings/offline.tsx`, which this
plan does not mention; three instances tripped the duplication gate, and the shared shape was
extracted to `src/components/ScreenHeader.tsx` rather than exempted. `app/activity/save.tsx`
hand-rolled its own header with no back button (Save/Discard replace it); `ScreenHeader` gained
an optional `onBack`, rendering `headerLeft` only when provided, so that screen could adopt it
too without a different call shape. All four screens now use `ScreenHeader`, and
`useGoBackOrHome`'s `fallback` parameter was narrowed from `Href` to `Extract<Href, string>`
since it is a `useCallback` dependency and an object-typed `Href` would change identity every
render.

**Task 3 (this plan) is still outstanding** — the review doc has not been annotated, and that
remains legitimately unticked above.
