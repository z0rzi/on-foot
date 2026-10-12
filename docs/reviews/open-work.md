# Open work

A clean index of what is left. Started 2026-10-06, rewritten 2026-10-09 to drop finished work.
**Update it as items close** — remove the item and correct the count in the same commit.

**`docs/reviews/2026-09-10-full-review.md` stays authoritative** for the findings themselves; its
rows are ticked in place and carry the evidence. This file only indexes what is still open there,
plus work proposed outside the review. A finding the report rules `accept` or `none` (today DUP-6
and PERF-3) is not open work and is not listed here; its ruling lives in the report.

## At a glance

11 open findings · 1 bundled into backlog row 10 (below) · 10 outside it, of which 4 are error
handling, 3 are field findings, and 3 are everything else · plus 1 item proposed outside the review.

## The ranked backlog — row 10

The only backlog row not yet done (rows 1-9 are closed in the authoritative document). **Unblocked
and spec'd 2026-10-11**: `docs/design/specs/2026-10-11-provider-cleanup-design.md`, with the
decision that unblocked it in `docs/adr/0002-offline-is-a-provider-requirement.md`.

| # | Work | Findings | Size | Risk |
| --- | --- | --- | --- | --- |
| 10 | ~~Retire `primary`/`overlayScrim`; delete `isValidCapabilities` and the three unread capability flags including `offline`; `estimatePackSize` returns bytes~~ (**done** — `2f7bbb2`); bridge `followUserMode` explicitly | DEAD-1..3, ARCH-3, ARCH-4, DOC-5 | S | Low |

### Tickets — sliced 2026-10-12

Two tickets, neither blocked by the other. **Ticket 1 landed 2026-10-12 (`2f7bbb2`)**; ticket 2 is
`ready-for-agent` and tagged on its entry below. Each lands green on `npm run verify`, removes its
own entries from this file and ticks its own rows in the authoritative document.
**Whichever lands second also closes the row** — so ticket 2 now does: it deletes
this section and the table above, strikes row 10 in the authoritative document's backlog table with
both commit hashes, and rewrites `## At a glance` by enumeration.

- **Ticket 1 — the deletions** · DEAD-1, ARCH-4, DOC-5, DEAD-2, DEAD-3 · **done** (`2f7bbb2`).
  What to build: a tree with nothing the spec names as unread. The capability type holds only its
  id, the terrain flag and the style list; the capability validator and its test are gone, and the
  provider's capabilities test keeps only the terrain assertion. The offline-controller comment on
  the port says offline is required on every provider, enforced by the required member, and points
  at ADR 0002 for why. The theme has no `primary` or `overlayScrim` token in its type or either
  palette. The pack-size estimate returns a byte count, its one-field wrapper type is gone, the
  layer chooser holds the bytes directly, and the two estimate tests assert the number against the
  tile-count building block times the per-tile constant.
  - [x] No reference to the removed flags, validator, tokens or wrapper type remains in `src/` or
        `app/`
  - [x] The port comment states the invariant and cites the ADR; it no longer describes a gate
  - [x] `npm run verify` green; the `seams` test is untouched
  - [x] The five entries leave this file and their rows are ticked in the authoritative document
- **Ticket 2 — follow mode translated at the seam** · ARCH-3 · blocked by: none.
  What to build: the map adapter maps each port follow-mode literal to the provider's tracking
  enum through an explicit `Record` keyed by the port union, so a fourth literal without an entry
  fails to compile. The double cast is gone, and an undefined follow mode still passes through as
  undefined. No unit test: the `Record` is exhaustive by type. The spec's one device check (follow
  mode in `normal`, `compass` and `course` behaves as before; leaving follow mode still clears it)
  is the owner's and is recorded, not claimed.
  - [ ] The adapter has no `as unknown as` on the follow-mode prop and no other cast replaces it
  - [ ] `npm run verify` green
  - [ ] The ARCH-3 entry leaves this file, its row is ticked, and the device check is listed under
        `## Pending device checks` until the owner confirms it

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
- **ARCH-3** · minor, S, ready-for-agent (row 10, ticket 2). Unjustified double cast at the map
  seam: `adapter.tsx:52` casts `followUserMode as unknown as Mapbox.UserTrackingMode`. Fix: an
  explicit `Record<FollowUserMode, Mapbox.UserTrackingMode>` map.
- **DEAD-4** · minor, S. `src/net/netinfo.ts`'s `NetInfoState` re-export is consumed only by its
  own test; harmless, the test can import the type from the package directly.
- **TEST-1** · minor, S, partly closed (`4157735`). `formatBytes` is tested and moved to
  `src/format/units.ts`. `packDescriptor` and lifting `guardDownload`'s decision order into a pure
  `downloadDecision(status, freeBytes, estimate)` remain untested and open.

## Pending device checks

A finding can be closed on the code while still carrying a visual or runtime claim no device has
confirmed; that caveat then lives inside the closed finding's own note, where the lists above never
surface it. This section is the one place that lists such a claim.

**ERR-1 and ERR-2 were checked on a device on 2026-10-10**; the evidence sits in their own notes in
the authoritative document. Three fragments stayed unobserved rather than verified:

- **ERR-1** · whether `stopLocationUpdatesAsync` ever fails in practice. It has not been seen to.
- **ERR-2** · the distinct "no route" message, which needs a valid `<gpx>` root carrying zero
  points; both files tested failed earlier, at the root element.

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
