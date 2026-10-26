---
severity:
category: enhancement
size:
triage: needs-triage
source: "owner, tasks.md (moved 2026-10-26)"
blocked_by: []
---
# IDEA-23: a you-are-here dot on the elevation graph

Owner idea, already sketched; recorded as Future Work in
`docs/design/specs/2026-09-02-onfoot-rn-elevation-graph-design.md`. Its own brainstorm → spec → TDD
feature.

## Trigger

- **Not** computed live/continuously (saves battery, avoids error accumulating while the phone is
  pocketed).
- Runs **only when the map is on-screen** (unlock / foreground / open the sheet) as a **batch
  replay** over the full recorded track.

## The one-rule algorithm

Walk the recorded track in time order, carrying an arc-length `s` on the trail. For each recorded
point:

```
candidates = trail points within R metres of the recorded point
if none:            skip (off-trail here; s unchanged)
else if s is null:  s = nearest candidate's arc-length   # cold start
else:               s = candidate whose arc-length is closest to s
```

- **Dot position** = `s` of the **last** recorded point.
- If that last point had **no candidates → show nothing** (genuinely off-trail right now — the
  only "hidden" case).

## Key parameters and decisions

- **R ≈ 20–30 m** (not 10 m) — must absorb GPS error, or the dot flickers out while on-trail (the
  AllTrails failure mode to avoid).
- **Tiebreak = symmetric "closest to `s`"** (provisional default). Dense track sampling makes `s`
  move in small steps that follow travel direction, so it honours "go back when I actually go
  back". Rejected: *forward-bias* (sticks forward, lags on reversal) and *forbid-back* (flickers,
  re-adds a state machine).

## Behaviours that fall out for free

- **Backwards travel** → `s` decreases (symmetric rule).
- **Out-and-back, shared loops, figure-8 crossings** → handled by closest-to-`s`; no false jump to
  the other branch, but a correct snap when there is a single unambiguous candidate.
- **Cold start mid-hike on an overlap** → replay from the recording's start establishes `s` before
  reaching the overlap.

## Caveats

- **Deliberate shortcut skipping ahead** → biased toward "closest to last `s`" (behind you); rare,
  predictable, self-corrects.
- **True self-overlap ambiguity** cannot be resolved from position alone — needs
  **direction of travel** (trend of `s` over recent points), the hardening lever if ever needed.

The scenarios (out-and-back, shared loop, leave-and-rejoin-elsewhere, GPS glitch,
same-direction-overlap rejoin, cold-start-on-overlap, figure-8, backwards) become its named test
cases, and the three tiebreak candidates are decided by running them.
