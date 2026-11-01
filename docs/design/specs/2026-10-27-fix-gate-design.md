# Fix Gate — No GPS Jumps in a Recorded Track — Design

**Status:** Approved design (challenge-reviewed 2026-10-27; the owner's calls settled 2026-11-01)
**Ticket:** `IDEA-17`
**Plan:** `docs/design/plans/2026-10-27-fix-gate.md`
**Date:** 2026-10-27

## The problem

Every fix the location service delivers becomes a point of the track. `locationTask.ts` drops
only fixes older than the current segment (`fixesInSegment`); a fix's `accuracy` is read for the
debug log and then discarded.

Reproduced 2026-10-26, phone still on a desk, foreground, one fix every ~5 s
(`.scratch/device-checks/2026-10-26/C/31-debuglog-c4-b.png`):

| time | accuracy | metres from previous point |
|---|---|---|
| 23:26:21 | 3.5 m | 0 |
| 23:26:26 | **383 m** | **675** |
| 23:26:31 | **390 m** | 0 |
| 23:26:37 | 34 m | **674** |

Two coarse fixes at the same wrong position, an out-and-back of 1.35 km in 16 s, drawn as a
straight red line. The elevation noise filter's spec named this gap and deferred it here ("gain is
now the trustworthy metric and distance is not yet").

## The decision

A **gate at capture**: a fix becomes a point only if it passes two rules. Rejected fixes are never
stored, so the map line, the live distance and the metrics saved with the activity are corrected
by one change at one layer.

The gate is domain policy — what a walker can plausibly do — so it lives in `src/recording/`, not
in the location port (a provider adapter) and not post-hoc in `computeMetrics` (which would correct
the distance but leave the drawn line wrong, because the stored geometry *is* what the map draws).

### Rule 1 — accuracy

A fix whose horizontal accuracy exceeds **`MAX_ACCURACY_M = 50`** is rejected. A fix of unknown
accuracy is kept: unknown is not bad, and the port does not promise the field.

**Unknown is normalised at the seam.** Android reports a missing accuracy as `0.0`, not null
(`Location.getAccuracy()`, passed through by
`node_modules/expo-location/android/.../records/LocationResults.kt:148`); iOS reports an invalid one
as a negative number. `toLocationFix` maps any accuracy `≤ 0` to `null`, so `LocationFix.accuracy`
is either a positive radius in metres or `null`, on every provider. A literal 0 m fix would
otherwise read as perfect.

This is the rule that fixes the reproduced incident: both bad fixes read > 380 m.

### Rule 2 — jump

A fix is rejected when its distance from the **anchor** — the last stored point of the current
segment — exceeds what a walker could cover in the time elapsed, plus an allowance for two fixes'
noise:

```
distance(anchor, fix) > MAX_SPEED_MPS × Δt + JUMP_FLOOR_M
```

**`MAX_SPEED_MPS = 10`** (36 km/h: a downhill run is covered) and **`JUMP_FLOOR_M = 50`** (12 m of
jitter one second after the anchor is 12 m against 60 m, not "12 m/s"). `Δt ≤ 0` is rejected: the
anchor already stands for that instant, and it is how a batch delivered out of order is refused.

**What rule 2 is and is not.** Δt runs from the anchor, so the allowance grows by 10 m/s while
fixes are being rejected and a walker moves at ~1.3 m/s: the rule **heals itself** — an anchor
`D` m wrong is overtaken after about `(D − 50) / 8.7` s, and the track resumes with one chord. The
same property makes it a **short-gap rate check**, not a jump detector across gaps: after a
5-minute delivery gap the allowance is 3 km. The 2026-10-26 incident (675 m in 5 s against 100 m)
would be caught by rule 2 alone; at Δt ≥ 62.5 s it would not. Rule 2 depends on rule 1, not the
reverse. It is kept because it is cheap and catches a jump that reports a plausible accuracy
(multipath, a wifi fix under 50 m) — IDEA-17's "~500 m jumps" carry no accuracy figure.

**No anchor, no jump rule.** The first fix of a segment (start, resume, relaunch) has nothing to
compare with; only rule 1 applies. Segments are disjoint by design — a resume 2 km from the pause
is a walk, not a jump.

**The gate folds.** Within a delivery, each kept fix becomes the anchor for the next. A delivery is
a single fix in the foreground and, in the background, at least 15 s **and** 50 m of fixes
(`deferredUpdatesInterval` / `deferredUpdatesDistance` are minimums, not caps).

### Anchor recovery

Without recovery, a hiker who forgets to pause during a 10 km drive between trailheads loses ~17
minutes of walking after arriving: the allowance needs ~1000 s to reach the car's distance. So a
fix rejected by rule 2 may become the **candidate**, and when the next fix is a jump from the
anchor but plausible from the candidate, the two agree against the anchor: the new fix is kept and
becomes the anchor.

**Agreement is only evidence when both fixes are GNSS-grade.** Errors from the same source are
correlated: the incident's two coarse fixes sat at the *same* wrong position, and a wifi fix inside
a station or hut repeats its wrong position at 30–48 m reported accuracy. Agreement between two
such fixes would re-anchor onto the error and store exactly the spike this gate exists to stop. So
only a fix whose accuracy is known and **≤ `RECOVERY_ACCURACY_M = 20`** can become the candidate or
confirm one. A rejected fix above that is simply dropped and the current candidate is kept. With
unknown accuracy, recovery never fires and rule 2's self-healing is the fallback.

The candidate lives only in memory, tagged with its session and segment: a different tag means a
different stream, and the candidate is ignored. It is never persisted — after a process death the
relaunch opens a new segment anyway.

### Where the anchor comes from

The anchor is read from the **repository** — the last stored point of `(session, currentSegment)`
— not from `recordingStore.livePoints`. The handler already takes its session from the repository
(`getActiveSession`), and at a cold start the store is empty until `resumeIfActive` hydrates it
(`useResumeRecording` waits for navigation); a store anchor would silently switch rule 2 off
exactly there. The durable rows are the source of truth, as everywhere else in recording.

### Deliveries are serialised

`expo-task-manager`'s JS listener awaits each execution but does not queue them
(`node_modules/expo-task-manager/build/TaskManager.js:140-147`), so two deliveries can interleave:
both read the same anchor, both append. The gate makes that read-decide-write sequence matter, so
the background fix handler runs through a `createSerialQueue` (`src/async/serialQueue.ts`, the
primitive `recordingController` already uses). Each delivery sees the anchor the previous one left.

### Constants are fixed

Like the elevation filter's: distance is a fact about the walk, not a preference. No setting.

| constant | value | role |
|---|---|---|
| `MAX_ACCURACY_M` | 50 | rule 1 ceiling |
| `MAX_SPEED_MPS` | 10 | rule 2 rate |
| `JUMP_FLOOR_M` | 50 | rule 2 noise allowance |
| `RECOVERY_ACCURACY_M` | 20 | a fix good enough to vote on the anchor |

Reasoned from known accuracy ranges and one captured incident, not calibrated. The new log fields
below are what calibrates them; each is a one-line change.

### Accuracy is not persisted

`TrackPoint` gains no field and `recording_points` no column. The gate consumes accuracy before
storage. "Persist the minimum" holds; no migration.

### What is logged

The gate is the only place that knows why a fix vanished, and once it rejects jumps the existing
`metresFromPrevious` (measured to the first *kept* fix) would no longer show the 675 m that
diagnosed this bug. Each `fix batch` entry therefore carries, still without a coordinate:

- `droppedBeforeSegment` — the existing `dropped`, renamed so it cannot be read as a gate count;
- `droppedAccuracy`, `droppedJump`;
- `worstRejectedAccuracy` — the largest accuracy rule 1 rejected, or null;
- `worstJump` — `{ metres, allowedMetres, seconds }` of the rejected jump that most exceeded its
  allowance (largest `metres − allowedMetres`), or null;
- `recovered` — how many fixes were kept by recovery;
- `metresFromAnchor` — from the segment's anchor to the first fix *in the segment*, gated or not,
  so a jump still shows its size (it replaces `metresFromPrevious`, measured to the first kept fix
  and across segments).

The gate returns its counts and worst figures; `fixBatchSummary` formats them and measures only
`metresFromAnchor`, the one distance the gate does not compute. Being recording-domain formatting
with one caller, `fixBatchSummary` lives in `src/recording/`: the log module stays domain-agnostic.

## Scope

**In:** accuracy normalisation in the adapter, the two rules, recovery, the repository anchor,
serialised deliveries, the log fields, the glossary's Recording terms.

**Out, deliberately:**

- **Saved activities and imported GPX.** No backfill, no gate on import — the elevation spec's "no
  back-filling" stance. A post-hoc distance filter is its own ticket if evidence asks for it.
- **Standstill jitter.** Wander under the floor inflates distance by a little; it needs a different
  filter. The 2026-10-26 log shows `0 m` steps every 5 s at a desk, so `distanceInterval` does not
  stop deliveries, but the honest fixes there were 0 m apart and added nothing.
- **A weak-signal hint in the UI** — rejected, `.out-of-scope/weak-signal-warning.md`. With a gate, a canyon where every fix exceeds 50 m
  shows a stalled line and a stalled distance, and approximate-only location permission (Android
  12+) records nothing at all, both silently. Today's behaviour is a zig-zag of coarse fixes in the
  first case and a track at kilometre granularity in the second — neither is usable either. The owner
  ruled it stays silent; the log already records it.
- **`IDEA-38`.** Its "1000 hours per km" is a *slow* pace: time divided by a near-zero distance at
  the start of a walk, not this bug's jump. It is a display floor on pace/speed, independent of the
  gate.
- **Fixes appended to a stale segment at cold start.** Between `_layout` defining the task and
  `resumeIfActive` opening the relaunch segment, a delivery is appended to the session's previous
  segment. Pre-existing and unchanged; the gate behaves consistently there (anchor = that segment's
  last point, a large Δt).

## Existing shape

**Closest:** the elevation noise filter, `src/data/geo/elevationFilter.ts`, the other place the
app distrusts the sensor. **Reused:** the stance (fixed, documented constants, no setting, no
backfill, consequences listed) and the shape (a pure module of named constants and functions,
tests asserting numbers).

**Not reused, and where it differs:** its layer and its reversibility. Elevation is filtered
post-hoc and the raw `ele` stays stored, so a better filter can recompute. The gate discards before
storage, so a fix it wrongly rejects is gone. That is the opposite stance on the property that
matters, taken because the stored geometry is what the map draws; the log fields above are what
keep the decision auditable without persisting rejected fixes.

**Already there, used rather than duplicated:** `haversineMeters` (`src/data/geo/metrics.ts`),
`fixesInSegment` (`src/recording/session.ts`), `fixBatchSummary` (moved to `src/recording/`), `createSerialQueue`
(`src/async/`). The gate's anchor is typed structurally (`{ lat, lng, t }`), like
`fixesInSegment<T>`: it is a stored `TrackPoint`, not a `LocationFix`.

**Extracted:** nothing new. If a post-hoc distance filter is ever written, the jump formula is what
it would share.

## Failure modes

| mode | outcome |
|---|---|
| Every fix of a delivery rejected | Nothing stored; the delivery is logged with its reasons and worst figures. Live sheet unchanged. |
| Accuracy unknown on every fix | Rule 1 never fires, recovery never fires; rule 2 alone, self-healing. |
| First fix of a segment bad but ≤ 50 m | Stored as the anchor. Honest fixes are rejected until rule 2 heals (`(D − 50) / 8.7` s) or two ≤ 20 m fixes agree; one chord on the line. |
| Wifi cluster under 50 m (station, hut) | Rejected by rule 2; cannot re-anchor (> 20 m). Dropped. |
| Coarse fixes everywhere (canyon, approximate permission) | Nothing kept while they last; line and distance stall; one chord when good fixes return. Logged (`droppedAccuracy`, `worstRejectedAccuracy`); no UI (`.out-of-scope/weak-signal-warning.md`). |
| Downhill run | 8 m/s over 15 s = 120 m against 200 m. Kept. |
| Vehicle without pausing | Not recorded while moving; the first two ≤ 20 m fixes after it re-anchor. |
| Overlapping deliveries | Serialised; the second sees the first's anchor. |
| Delivery out of order | Its fixes are older than the anchor: `Δt ≤ 0`, rejected. |
| Long delivery gap | Rule 2 permits a lot on the first fix back; rule 1 still applies. |
| Process death | Candidate lost; relaunch opens a new segment; nothing to recover. |
| Device clock moves backwards | `Δt ≤ 0` until timestamps pass the anchor; logged as jumps. |
| Repository read fails | The delivery throws as an `appendPoints` failure would today, caught and logged by TaskManager; the next delivery retries. |

## Consequences accepted

- **A wrongly rejected fix is gone.** Auditable through the log, not recoverable.
- **Anything faster than 36 km/h is not recorded.** What the app is for.
- **A bad anchor costs one chord**, bounded by rule 2's healing.
- **One extra indexed read per delivery** for the anchor.

## Device check (the owner's step)

1. **Indoors, phone still, 2 min.** Pass: no line segment longer than ~50 m, distance grows by at
   most tens of metres, and the log shows `droppedAccuracy > 0` on at least one delivery (the proof
   rule 1 fired, rather than the GPS being good that day). Pace may still read absurd: that is
   `IDEA-38`.
2. **A walk of known length, open sky.** A regression check, not a repro: distance within ~5 % of
   the expected length, no spike, `droppedJump` 0 or near it.

## Owner's calls

Proposed on 2026-10-27, approved by the owner on 2026-11-01:

- **Discard rather than keep-and-hide.** Rejected fixes are not stored; the log carries the
  calibration data instead.
- **No weak-signal UI**, now or later (`.out-of-scope/weak-signal-warning.md`).
- **`RECOVERY_ACCURACY_M = 20`** rather than "three fixes agree": simpler, and it targets the actual
  failure (coarse sources agree with themselves).

## Docs

- `GLOSSARY.md`: new **Recording** section — Fix, Point, Segment, Jump.
- `docs/architecture/debug-log.md`: the `fix batch` fields.
- No ADR: four constants at one layer, reversible, the trade-off recorded here.
