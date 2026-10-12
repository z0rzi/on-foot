# Open work

A clean index of what is left. Started 2026-10-06, rewritten 2026-10-09 to drop finished work.
**Update it as items close** — remove the item and update `## At a glance` in the same commit.

**`docs/reviews/2026-09-10-full-review.md` stays authoritative** for the findings themselves; its
rows are ticked in place and carry the evidence. This file only indexes what is still open there,
plus work proposed outside the review. A finding the report rules `accept` or `none` (today DUP-6
and PERF-3) is not open work and is not listed here; its ruling lives in the report.

## At a glance

Open findings, by section below:

- **Field findings** — FIELD-1, FIELD-3, FIELD-5.
- **Error handling** — ERR-4, ERR-5, ERR-6, ERR-7.
- **Everything else** — ARCH-2, DEAD-4, TEST-1.

The ranked backlog is finished: **row 10 closed 2026-10-12** (`2f7bbb2`, `d08668c`), the last of the
ten. Nothing from the review's backlog is open, so there is no backlog section here any more.

Proposed outside the review, each needing its own spec: the `OfflineBadgeState` rename, the
unnamed follow-mode union, and progressive route rendering — all at the end of this file.

## Field findings

**FIELD-1 — the system kills the app in the background** · should-fix, investigate. Open, and the
most interesting thing left. Every data point says **memory, not CPU**: the one excessive-CPU kill was
~3.9% against a 2% cap, while the footprint runs 474-512 MB pss / 595-624 MB rss across every
sample.

The finding has been redirected twice by evidence. The original question — what burns CPU while
cached — was wrong. The second answer, "it tracks what a *recording* retains", is **also wrong**:
`dumpsys meminfo` on 2026-10-07 at 16:23, with the app merely showing a map and **not recording**,
read 474 MB pss / 595 MB rss — Native Heap 199 MB, Graphics 125 MB, Dalvik 15 MB. A recording adds
only tens of MB on top of that.

So the bulk is the map SDK's tiles and textures, resident whenever the map is open, and
`livePoints` is no longer the first suspect. Next step: sample `meminfo` with the map closed (on
the Trails or Settings tab) to separate the map's share from the rest, and check whether Mapbox's
tile cache is bounded in this app's configuration.

**FIELD-3 — the interruption toast is hidden, and its range overstates the gap** · minor, S. The
toast fires behind the splash, and its range starts at the last stored point rather than the gap's
real start. The debug log records the announced range, so a fix can be checked against real field
data instead of a guess.

**FIELD-5 — a crash in a relaunched recording process can hang instead of dying** · investigate.
Open, seen once, unconfirmed. Ironically harder to reproduce now that `FIELD-4` — the crash that
produced it — is fixed.

## Error handling

**ERR-7 — a deleted trail leaves a permanently dangling `linked_trail_id`** · should-fix, S.
`schema.ts:21,41` declares the column as a plain `integer` on both `activities` and
`recording_sessions` — no foreign key, no `ON DELETE SET NULL` — and `trailsRepository.ts:26-28`'s
`deleteTrail` removes only the trail row. So the link is stuck forever, and the loaded-entity hook
writes a `warn` every time that activity's sheet opens. Repeating benign noise is what degrades
the debug log. Fix: null the column in `deleteTrail`, or add the FK and let SQLite enforce it.

**ERR-6 — `metricsForSegments` runs outside the surrounding `try`** · should-fix, S.
`app/trail/new.tsx:50` sits after the `try`/`catch` at `:33-47` closes, so a throw there is an
unhandled rejection behind a spinner that never exits — `ERR-3`'s defect class, in a file the
loaded-entity work touched. Deliberately not folded into that `try`: it would report "Not a GPX
file" for something that is not a parse failure. Fix: a third outcome in the same effect.

**ERR-5 — unhandled picker rejection** · minor, S. `trails.tsx:68-77`'s `pickGpx` is an async
`onPress` that can reject (an eslint attribute exemption hides it), and `:27`'s `void loadTrails()`
on focus is the same shape with no failure outcome.

**ERR-4 — silent no-ops** · minor, S. Tapping an activity during a recording returns with no
feedback; a failed offline-registry `init` leaves the settings list saying "No offline maps yet"
until the app restarts, because `OfflineMapsList` reloads trails on focus but never re-`init`s.

## Everything else

- **ARCH-2** · minor, S. A native boundary outside the seam scanner: `modules/share-intent` calls
  `requireNativeModule` directly and nothing stops a second call or a direct `expo-modules-core`
  import in `src/`. Fix: add `modules` to the scan roots and a seam entry, or record the exemption
  in `seams.md`.
- **DEAD-4** · minor, S. `src/net/netinfo.ts`'s `NetInfoState` re-export is consumed only by its
  own test; harmless, the test can import the type from the package directly.
- **TEST-1** · minor, S, partly closed (`4157735`). `formatBytes` is tested and moved to
  `src/format/units.ts`. `packDescriptor` and lifting `guardDownload`'s decision order into a pure
  `downloadDecision(status, freeBytes, estimate)` remain untested and open.

## Pending device checks

A finding can be closed on the code while still carrying a visual or runtime claim no device has
confirmed; that caveat then lives inside the closed finding's own note, where the lists above never
surface it. This section is the one place that lists such a claim.

- **ERR-1 and ERR-2** were checked on a device on 2026-10-10; the evidence sits in their own notes
  in the authoritative document. Two fragments stayed unobserved rather than verified: whether
  `stopLocationUpdatesAsync` ever fails in practice (it has not been seen to), and the distinct
  "no route" message, which needs a valid `<gpx>` root carrying zero points — both files tested
  failed earlier, at the root element.
- **ARCH-3** (row 10, ticket 2, `d08668c`) — the follow-mode bridge. The `Record` makes the port
  literal → tracking enum correspondence explicit and the compiler proves it exhaustive, and the
  three strings it emits were read off both native sources (Android `UserTrackingMode.fromString`,
  iOS's `UserTrackingMode`), so they are the same strings the cast produced. But the camera is
  native rendering: that follow mode in `normal`, `compass` and `course` behaves as before, and
  that leaving follow mode still clears it, is unconfirmed until the owner checks it on a device.

## Decisions parked for a human

- **From the debug-log work**: `src/log/index.ts` is a half-barrel five consumers bypass; the
  viewer has no area filter while `fix batch` is ~95% of entry volume; the three sheet-geometry
  reads are not collapsed into one `runOnUISync`; a migration-failure launch cannot be logged at
  all.

## Proposed work — not from the review

- **`OfflineBadgeState` is misnamed** · minor, S, proposed by the owner 2026-10-11. The type drives
  the badge, the downloading progress block *and* the ⋮ menu in `TrailInfoSheet`; "badge" names one
  of three. Rename to `TrailOfflineStatus`, `offlineStateForTrail` → `offlineStatusForTrail`,
  `badge.ts` → `status.ts`. Touches `offline/types.ts`, `badge.ts`, `menu.ts`, `TrailInfoSheet.tsx`
  and two tests; no behaviour. Deliberately kept out of row 10, which is deletions.

- **The follow mode union has no name, and speaks Mapbox's words** · minor, S, surfaced by ticket
  2's code review 2026-10-12. Three observations about one union, all out of ticket 2's scope:
  (a) `'normal' | 'compass' | 'course'` is spelled out twice — `map/provider/types.ts:24` and
  `store/mapStore.ts:72` — while the spec and the review both call it `FollowUserMode`, a name the
  code never got; extracting it on the port would collapse the duplicate and give `TRACKING_MODE`
  an honest key instead of `NonNullable<CameraProps['followUserMode']>`. (b) Nothing produces
  `'course'`: `followCameraProps` emits only `'normal'` and `'compass'`, so the port declares a
  literal no caller uses. (c) The three literals *are* Mapbox's enum values, so the port's
  vocabulary is the current provider's — the shape AGENTS.md means by "provider-specific concepts
  … never leaked as literals into shared code", and what makes a MapLibre provider implement a
  port written in Mapbox's words. (a) and (b) are safe today: the `{...follow}` spread in
  `MapCanvas.tsx` makes a divergent store literal a compile error. Needs one decision — rename the
  port's literals to the app's own vocabulary, or accept the coincidence and say why — so it gets
  a spec rather than a quick edit.

- **Progressive route rendering** · proposed by the owner 2026-10-07, after measuring a 13.3 km
  trail selection at 657 ms of frame activity. Show the trace on the map immediately as a plain
  line, then let the profile, the slope colours and the elevation graph arrive a beat later. It
  works because Mapbox draws on the native thread: once JS hands over the plain coordinates the
  map can paint while JS is still deriving. `useRouteDisplay` is now the one place that derives the
  profile, so deferring it is one change and everything downstream appears together. Likely idiom:
  `useDeferredValue(segments, null)` (the two-argument form is present in React 19.2.3's types —
  checked). **Measure before designing**: the 657 ms is at least two costs — the `JSON.parse` of
  the whole track, which deferral cannot help, and the profile/banding arithmetic, which it can.
  The split is unknown, and if the parse dominates this buys less than it looks; `useRouteDisplay`
  is now the single place to instrument that. **Open design question**: on a short route the
  derivation is already fast, so deferring could add a flicker where today it is instant — probably
  wants a size threshold, which needs its own device verification. Gets its own spec.
