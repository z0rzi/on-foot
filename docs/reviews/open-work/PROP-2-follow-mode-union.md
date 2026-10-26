---
severity: minor
category: enhancement
size: S
triage: ready-for-human
source: row 10 ticket 2 code review, 2026-10-12
blocked_by: []
---
# PROP-2: the follow mode union has no name, and speaks Mapbox's words

Three observations about one union, all out of ticket 2's scope:

- (a) `'normal' | 'compass' | 'course'` is spelled out twice — `map/provider/types.ts:24` and
  `store/mapStore.ts:72` — while the spec and the review both call it `FollowUserMode`, a name the
  code never got; extracting it on the port would collapse the duplicate and give `TRACKING_MODE`
  an honest key instead of `NonNullable<CameraProps['followUserMode']>`.
- (b) Nothing produces `'course'`: `followCameraProps` emits only `'normal'` and `'compass'`, so the
  port declares a literal no caller uses.
- (c) The three literals *are* Mapbox's enum values, so the port's vocabulary is the current
  provider's — the shape AGENTS.md means by "provider-specific concepts … never leaked as literals
  into shared code", and what makes a MapLibre provider implement a port written in Mapbox's words.

(a) and (b) are safe today: the `{...follow}` spread in `MapCanvas.tsx` makes a divergent store
literal a compile error. Needs one decision — rename the port's literals to the app's own
vocabulary, or accept the coincidence and say why — so it gets a spec rather than a quick edit.

## Why a human

Needs one design decision: rename the port's follow-mode literals into the app's own vocabulary, or
accept that they match Mapbox's and record why. That decision then gets a spec (with
`## Existing shape` and `## Failure modes`) before any code.
