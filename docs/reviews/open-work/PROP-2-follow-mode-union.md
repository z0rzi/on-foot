---
severity: minor
category: enhancement
size: S
triage: ready-for-agent
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

## Comments

> *Comment written by an AI agent.*

Owner ruling 26/10 → `ready-for-agent`. The port speaks the app's vocabulary: it reuses `FollowMode` (`position` / `positionAndBearing`, `src/store/mapStore.ts`) or a semantic equivalent declared on the port; the translation to `'normal'`/`'compass'` lives in the Mapbox adapter; `'course'` goes away, and so does the duplicated literal. Short spec first (`## Existing shape`, `## Failure modes`), as the ticket asks.

## Agent Brief

**Category:** enhancement
**Summary:** The map port's follow mode speaks the app's vocabulary; the Mapbox adapter translates.

**Current behavior:**
`CameraProps.followUserMode` (`src/map/provider/types.ts:24`) and `FollowCameraProps.followUserMode`
(`src/store/mapStore.ts:72`) both spell Mapbox's `'normal' | 'compass' | 'course'`; `'course'` is never produced.

**Desired behavior:**
The port carries an app-owned follow-mode type (reuse `FollowMode` or a narrower semantic type
on the port — decide in the spec, without creating a store→port or port→store cycle). Only
`src/map/providers/mapbox/` knows `'normal'`/`'compass'`. No literal duplicated.

**Acceptance criteria:**
- [ ] Spec under `docs/design/specs/` with `## Existing shape` and `## Failure modes`.
- [ ] No Mapbox follow literal outside `src/map/providers/mapbox/`.
- [ ] `'course'` gone; mapping tested as a pure function.
- [ ] `npm run verify` green; follow-mode device check re-listed for the owner.

**Out of scope:**
- Changing follow behaviour, zoom or pitch.
