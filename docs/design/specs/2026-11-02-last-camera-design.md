# Last Camera Restored at Launch — Design

**Status:** Approved design (owner's grilling 2026-11-02, recorded in `IDEA-18`)
**Ticket:** `IDEA-18`
**Plan:** `PROP-46` → `PROP-47` → `PROP-48` (`docs/reviews/open-work/`)
**Date:** 2026-11-02
**Decision record:** `docs/adr/0003-last-camera-restored-when-free.md`

## The problem

Every launch starts in position follow from the provider's default camera, the whole-earth view.
`followMode` and the camera are session-only (`src/store/mapStore.ts`, `partialize`), as the
restore-last-map-state spec (2026-08-21) locked. In the field the system kills the app in the
background (`FIELD-1`), including while the save-activity screen is open (`FIELD-37`, merged into
`IDEA-18`), so a relaunch comes back on the globe and sweeps to the user, throwing away a framing the
owner set by hand. ADR 0003 reverses the session-only rule.

Terms are the glossary's: **Follow**, **Free camera**, **Last camera**.

## The decision

1. **The follow state is persisted exactly**: position, position and heading, or free (`'off'`).
   Following at the last leave → launch follows as today, in the same mode. Free → the last camera is
   restored.
2. **No distance threshold.** The restored view stands however far the user now is from it; the
   position button re-follows as today.
3. **The last camera is centre, zoom, pitch and heading.**
4. **It is captured every time the camera comes to rest**, not only when the app goes to the
   background. Capture runs whatever the follow state; only a free launch reads it.
5. **An invalid last camera is ignored**: launch follows as today, and the debug log gets one `warn`
   line. Invalid means a non-finite number, a latitude or longitude out of range, or a zoom outside
   the provider's range. A missing last camera with a persisted free state is treated the same way.
6. **No globe frame on a free launch.** The map waits for the map store's hydration and starts on the
   last camera declaratively, through the port's initial camera, not by moving the camera after the
   first frame.

A restored trail selection keeps the 2026-08-21 rule: overlay and info card shown, no fit. Nothing
else joins the persisted subset: a pending fit and an activity selection stay session-only.

## Design

### The port (`PROP-46`)

`src/map/provider/types.ts` gains one SDK-neutral framing type, `CameraFraming` (centre as
`[lng, lat]`, zoom, pitch, heading), used three ways:

- `MapViewProps.onCameraChanged` delivers a `CameraFraming` instead of `{ heading }`. The North
  button reads `heading` from it, unchanged.
- `CameraProps.initialCamera?: CameraFraming`. The provider applies it once, the first time it is
  defined, without animation: at mount it is the camera's starting framing, before the first
  rendered frame; defined later (a late hydration, only possible before `PROP-48`), it is a jump.
  Later changes are ignored. "Once" is the port's contract, so a caller can never move the camera
  through it by accident.
- `MapCapabilities` declares the provider's camera zoom range (`minZoom`, `maxZoom`), which the
  validity predicate takes as input. No Mapbox number is written in shared code.

The Mapbox adapter translates all three in `src/map/providers/mapbox/` only. No caller passes an
initial camera yet; behaviour is unchanged.

### Capture and launch (`PROP-47`)

- **Store.** The map store gains `lastCamera: CameraFraming | null`, written by the camera-changed
  handler through a debounce, so it is written when the camera comes to rest. `partialize` adds
  `followMode` and `lastCamera`.
- **Validity.** A pure `isValidLastCamera(camera, zoomRange)`: finite numbers, latitude in
  [-90, 90], longitude in [-180, 180], zoom inside the provider's range. Pitch and heading are not
  range-checked: the provider clamps pitch, and heading is an angle.
- **Launch resolution.** A pure `launchCamera(followMode, lastCamera, zoomRange)` returns one of
  `{ kind: 'follow', mode }` (following at the last leave), `{ kind: 'restore', camera }` (free,
  valid) or `{ kind: 'follow', mode: 'position', invalid: true }` (free, invalid or missing). It is
  computed once, from the hydrated state, and held for the session: `lastCamera` keeps changing after
  launch, the launch decision does not.
- **Applying it.** `restore` → `MapCanvas` passes the camera as `initialCamera`, follow stays off,
  and the store's `cameraPitch` and `cameraHeading` are seeded from it, so the declarative manual
  pitch (`pitch: cameraPitch` when follow is off) holds the restored tilt instead of flattening it,
  and the North button shows if the view was rotated. Invalid → follow mode `position` and one
  `logEvent('warn', 'map', …)` naming the reason (non-finite, out of range, missing), with no
  coordinate.

Until `PROP-48`, hydration may land after the first frame: the globe shows briefly, then the
initial camera jumps to the last camera. That is tolerated in this slice only.

### No globe frame (`PROP-48`)

The map mounts once the map store has hydrated, using zustand persist's own hydration signal
(`persist.hasHydrated()` / `onFinishHydration`), not a timer guess in a component. The native splash
is held (`expo-splash-screen`) until then. A bounded wait caps it: past the bound the map mounts on
the defaults (follow) and the debug log gets one `warn` line. The decision "hydrated or timed out"
is a pure, tested function. A launch that follows behaves exactly as today.

## Existing shape

- **The 2026-08-21 restore-last-map-state spec** is the same shape: one map-store field joins
  `partialize`, the launch reads the hydrated value, and a session-only intent (`pendingFit`) keeps
  a restore from moving the camera. Reused as is: the persisted subset, the "restore never fits"
  rule, the self-heal style (an unusable persisted value falls back to the default, here with a log
  line). This spec reverses only its "camera is session-only" line, and ADR 0003 records that.
- **The map store's persisted subset** (`mapStyleId`, a trail `selection`) gains `followMode` and
  `lastCamera`. Same storage key, same AsyncStorage engine, no seam change.
- **The port's neutral translations** (`onUserTrackingModeChange(following)`,
  `FollowUserMode` → `trackingModeFor`, 2026-11-01 follow-mode spec): `CameraFraming` and
  `initialCamera` follow them, the SDK shape only in the adapter.
- **Extracted to be shared:** `CameraFraming`, used by the camera-changed event, the initial camera
  and the stored last camera, so the three can't drift.

## Failure modes

- **Invalid last camera** (corrupt storage, a value from an older shape): ignored, launch follows
  in position mode, one `warn` line. The next rest overwrites it.
- **Missing last camera with a free follow state** (killed after a gesture but before the first
  rest was captured, or the first launch after upgrading): same as invalid.
- **Stale last camera** (killed mid-pan, before the debounce fires): the previous rest is restored.
  It is still a framing the user had; accepted.
- **Hydration fails** (AsyncStorage error): zustand persist keeps the defaults, launch follows as
  today. After `PROP-48` the gate opens on the failure and logs one `warn` line.
- **Hydration slow or never completes:** before `PROP-48`, a brief globe frame then the jump.
  After it, the splash holds up to the bound, then the map mounts on the defaults with one `warn`
  line. The app is never held.
- **No location permission or no position yet:** a free launch is unaffected, the restored camera
  needs no position. A following launch behaves as today (no puck, nothing to follow until a fix).
- **Restored trail selection with a free camera:** overlay and info card shown, no fit
  (`pendingFit` stays null); the camera sits on the last camera, which is typically the framing the
  user left on that trail.
- **Render-time throw:** none new. The resolution and predicate are total over their inputs; the
  adapter's translation is the only native contact and is device-verified.

## Testing

**Pure logic (Jest, TDD):** `isValidLastCamera` (finite, lat/lng range, zoom range edges, NaN,
Infinity); `launchCamera` (following in each mode, free + valid, free + invalid, free + missing);
`partialize` includes `followMode` and `lastCamera` and still excludes `pendingFit`; the hydration
gate's decision (hydrated, failed, timed out).

**Device-verified (the owner's step):** pan, tilt and rotate, kill, relaunch → same framing, no
globe frame (after `PROP-48`). Following at kill → relaunch follows as today. Kill with the
save-activity screen open while free → the map comes back on the last camera. North button still
appears and resets.

## Docs

`GLOSSARY.md` already defines Follow, Free camera and Last camera. The 2026-08-21 spec carries a
pointer to ADR 0003 where it keeps the camera session-only.
