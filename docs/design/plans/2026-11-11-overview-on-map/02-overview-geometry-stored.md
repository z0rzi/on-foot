---
status: open
blocked_by: ["[[01-columns-and-stores-at-launch]]"]
closes: []
---
# 02: every trail and activity keeps a light overview geometry

**What to build:** each trail and activity stores, beside its full geometry, an overview geometry
(the track simplified to about 10 m, positions rounded to 5 decimals, segments kept apart, as the
text of a GeoJSON MultiLineString) and its start point as two numbers, taken from the simplified
geometry (spec D120). Both are computed inside the two functions that build a row's stored values,
so a trail import and an activity save always write them. Rows saved before this are filled by a
one-time backfill (D121): one row at a time with a yield between rows, starting after the
migrations when no recording session exists and otherwise when the session ends, resuming at the
next launch if interrupted; an unreadable row gets an empty overview geometry and is logged once.
The stores' rows (from 01) carry the overview geometry text and the start point. The debug log
gains `map` / `overview backfill` `{ rows, failed, slowestMs, ms }` (D131).

- [ ] The simplification is a pure, test-first function: tolerance respected, segments kept apart,
      endpoints kept, empty and single-point input, rounding, valid GeoJSON geometry text out
- [ ] A migration adds the nullable columns; importing a trail and saving an activity write them
      (tests on both row builders)
- [ ] The backfill fills null rows, skips filled ones, marks unreadable ones once, waits for a
      recording session to end (tests)
- [ ] The store rows carry the overview geometry and start point
- [ ] `overview backfill` listed in `docs/architecture/debug-log.md`; no coordinate in it
- [ ] Device: after installing over the owner's data, the log shows one `overview backfill` with
      every row filled (spec Verification 14, backfill part)
- [ ] `npm run verify` green
