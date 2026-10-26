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
- **Not enough disk space for an offline download** is implemented but never checked on a device.
  The refusal writes a debug-log entry with the needed and free bytes, so a field occurrence leaves
  evidence.
- **FIELD-3** (interruption toast after the map loads): kill the process mid-recording, relaunch, and
  check that `No position between HH:MM and HH:MM` is seen over the map rather than behind the
  splash; the `announced an interruption` debug-log entry now marks when the toast was actually shown.
- **ERR-7** (`99cfff1`): migration 0008 has never run on a real database. After upgrading, open an
  activity whose trail was deleted earlier: no `linked trail not found` warning in the debug log.
  Then delete a linked trail and reopen its activity: still no warning.
- **ERR-4** (`d01df26`, `11fd0fe`): tap an activity while recording, the toast shows and nothing
  opens. A pack registered after a failed launch-time load appears once the offline maps list is
  opened; this needs a forced load failure, so it may stay unobserved.
- **ERR-5** (`1682d29`): a rejected file picker shows an alert. The picker rarely rejects, so this
  may stay unobserved; a cancelled pick still does nothing.
- **ERR-8**: the Trails and Activities tabs and the offline maps list still refresh on focus (import
  or record elsewhere, switch back, the new row is there). The failure toast needs a forced read
  failure, so it may stay unobserved.
- **PROP-8** (sheet geometry read in one `runOnUISync`): background the app on the map, bring it
  back, and check the debug log still shows an `app active` entry (area `map`) with `mode`,
  `windowHeight`, `sheetTop`, `rootHeight` and `graphBottom`, values matching the screen, and no
  Worklets error in logcat.
