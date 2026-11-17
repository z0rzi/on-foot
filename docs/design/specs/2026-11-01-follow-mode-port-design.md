# Follow Mode on the Map Port — Design

**Status:** Built, [[2026-11-01-worklist-batch]] (`c62fede`); approved by the owner's ruling of
2026-10-26
**Ticket:** `PROP-2`
**Plan:** `docs/design/plans/2026-11-01-worklist-batch.md`
**Date:** 2026-11-01

## The problem

`CameraProps.followUserMode` (`src/map/provider/types.ts`) and `FollowCameraProps.followUserMode`
(`src/store/mapStore.ts`) both spell `'normal' | 'compass' | 'course'`. Those are the values of
rnmapbox's `UserTrackingMode` enum, so the provider-agnostic port speaks the current provider's
words, and a MapLibre adapter would have to implement a port written in Mapbox's. The union is
written twice, and nothing produces `'course'`.

## The decision

The port declares its own type, in the app's vocabulary:

```ts
export type FollowUserMode = 'position' | 'positionAndBearing'
```

- **On the port, not reused from the store.** `src/map/provider/types.ts` imports nothing from the
  app; the store's `FollowMode` becomes `'off' | FollowUserMode`, a type-only import from the port.
  The dependency runs one way (store → port), so there is no cycle, and the literals are written
  once. `'off'` stays out of the port: the camera expresses "not following" with
  `followUserLocation: false`, not with a mode.
- **`'course'` goes.** No caller produces it; a future mode is added to the port when a feature
  needs one.
- **The translation lives in the Mapbox adapter.** `src/map/providers/mapbox/followMode.ts`
  exports the pure `trackingModeFor(mode)`, backed by a `Record<FollowUserMode,
  Mapbox.UserTrackingMode>`: `position` → `Follow` (`'normal'`), `positionAndBearing` →
  `FollowWithHeading` (`'compass'`). The `Record` keeps it exhaustive by type. `adapter.tsx` calls
  it where it already translated through `TRACKING_MODE`.
- **Behaviour unchanged.** The values reaching `Mapbox.Camera` are the same as before; zoom and
  pitch are untouched.

## Existing shape

The closest shape is the port's other semantic declarations translated in the adapter:
`StyleDescriptor.satellite` (a semantic flag the store reads instead of a Mapbox style id) and
`onUserTrackingModeChange(following: boolean)` (the adapter maps rnmapbox's payload to a neutral
boolean). This follows them: a neutral type on the port, the provider's enum only in
`src/map/providers/mapbox/`. The pure mapping sits beside `offline.ts`'s `mapPackState`, the
adapter's existing tested translation, and its test extends the same `@rnmapbox/maps` Jest mock with
the `UserTrackingMode` enum. Nothing new to extract.

## Failure modes

None at runtime: the mapping is a total function over a two-member union checked at compile time,
and no input reaches it from outside the app (no network, permission, file or user text). A port
member added without an adapter entry is a compile error, not a degraded mode. Location permission
and a manual gesture cancelling follow are handled where they are today (`MapCanvas`,
`onUserTrackingModeChange`), unchanged by this.
