# Open work

What is left lives in `open-work/`, one file per ticket, named `<ID>-<slug>.md`. A file that exists
is open; closing an item deletes its file in the same commit that closes it. `open-work.base` lists
them in Obsidian, by severity, by kind, and ready for an agent. Conventions are in
`docs/agents/issue-tracker.md`.

**`docs/reviews/2026-09-10-full-review.md` stays authoritative** for the findings it raised: its
rows are ticked in place and carry the evidence. A ticket file from that review summarises the
finding and links back to it. A finding the report rules `accept` or `none` (today DUP-6 and
PERF-3) is not open work and has no file; its ruling lives in the report.

## Pending device checks

A finding can be closed on the code while still carrying a visual or runtime claim no device has
confirmed; that caveat then lives inside the closed finding's own note, where no ticket surfaces
it. This section is the one place that lists such a claim — both the ones still waiting and the
residue a completed check could not reach.

- **ERR-1 and ERR-2** were checked on a device on 2026-10-10; the evidence sits in their own notes
  in the authoritative document. Two fragments stayed unobserved rather than verified: whether
  `stopLocationUpdatesAsync` ever fails in practice (it has not been seen to), and the distinct
  "no route" message, which needs a valid `<gpx>` root carrying zero points — both files tested
  failed earlier, at the root element.
- **ARCH-3** (row 10, ticket 2, `d08668c`) was checked on the device on 2026-10-12. `normal` is
  north-up and flat with the puck centred; `compass` tilts and rotates heading-up while holding the
  puck at the same screen point, and Mapbox's `LocationCompassEngine` registers the rotation-vector
  sensor on entry and unregisters it on exit — `FollowWithHeading` reaching the native layer. A
  manual pan clears follow. No `UserTrackingMode` error in logcat. **One fragment is permanently
  unobservable**: `course` has no producer, so no UI path exercises it; the `TRACKING_MODE` entry is
  correct by the native sources but will stay unexercised until the port's literals are decided
  (`PROP-2`). Also unobservable: the 2D/3D `content-desc` cannot be read while compass-follow
  animates — `uiautomator dump` returns `could not get idle state` and can serve a stale file, so
  that label is evidence only in a screenshot.
