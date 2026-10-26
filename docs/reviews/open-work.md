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

- **ERR-1 and ERR-2** were checked on a device on 2026-10-10, and ERR-2's distinct "no route"
  message on 2026-10-26; the evidence sits in their own notes in the authoritative document. One
  fragment stays unobserved: whether `stopLocationUpdatesAsync` ever fails in practice (it has not
  been seen to).
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
- **Not enough disk space for an offline download** is implemented but never checked on a device:
  it would mean filling the phone's storage. The refusal writes a debug-log entry with the needed
  and free bytes, so a field occurrence leaves evidence.
- **ERR-4, ERR-5, ERR-8** were checked on 2026-10-26 on every path a device reaches: the
  recording-tap toast, a cancelled pick doing nothing, and the Trails and Activities tabs and the
  offline maps list refreshing on focus. What needs a forced failure stays unobserved: ERR-4's pack
  registered after a failed launch-time load, ERR-5's alert for a rejecting picker, ERR-8's failure
  toast on a read error.
- **Map twist** (the north button after a two-finger rotation): `adb` cannot inject multi-touch on
  this phone (`sendevent` is refused by SELinux), so any rotation check is the owner's.
