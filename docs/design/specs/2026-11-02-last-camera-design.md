# Last Camera Restored at Launch — Design

**Status:** Built (owner's grilling 2026-11-02; following launches amended the same day after the
first device check)
**Ticket:** `IDEA-18`, delivered as `PROP-45` → `PROP-46` → `PROP-47` → `PROP-48` (closed; in git
history)
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
   Following at the last leave → launch follows in the same mode, starting from the last camera so
   the move to the user is short instead of a sweep from the globe (owner, 2026-11-02, after the
   first device check). Free → the last camera is restored.
2. **No distance threshold.** The restored view stands however far the user now is from it; the
   position button re-follows as today.
3. **The last camera is centre, zoom, pitch and heading.**
4. **It is captured every time the camera comes to rest**, not only when the app goes to the
   background. Capture runs whatever the follow state; every launch reads it.
5. **An invalid last camera is ignored**: launch follows from the provider's default camera, and
   the debug log gets one `warn` line. Invalid means a non-finite number, a latitude or longitude out of range, or a zoom outside
   the provider's range. A missing last camera with a persisted free state is treated the same way.
   A persisted follow state that is none of the three values (an older shape, corrupt storage) is
   ignored the same way: launch follows in position mode, one `warn` line.
6. **No globe frame at launch** when the last camera is usable, free or following. The map waits for the map store's hydration and starts on the
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
- `CameraProps.initialCamera?: CameraFraming`. The provider reads it once, at mount, and applies it
  without animation as the camera's starting framing, before the first rendered frame. Later
  changes are ignored. "Once" is the port's contract, so a caller can never move the camera through
  it by accident. (Until `PROP-48` a late hydration could define it after mount, so `PROP-46`'s
  adapter also applied a late first definition as a jump; `PROP-48` mounts the map only once the
  launch is decided, and that branch went with it.)
- `MapCapabilities` declares the provider's camera zoom range (`minZoom`, `maxZoom`), which the
  validity predicate takes as input. No Mapbox number is written in shared code. The Mapbox adapter
  declares 0–25 and enforces it on the camera (`minZoomLevel` / `maxZoomLevel`), so a declared
  range is never one the map can leave. 0–25 is rnmapbox Android's own default, so Android
  behaviour is unchanged.

The Mapbox adapter translates all three in `src/map/providers/mapbox/` only. No caller passes an
initial camera yet; behaviour is unchanged.

Two rnmapbox Android behaviours the adapter absorbs, both found on the device (2026-11-02): the
native camera applies `defaultSettings` only once the map view is attached, but starts a follow
transition at once from the whole-earth default, which then owns the camera — so with an initial
camera, follow is held off until the map has loaded; and before load the map reports the camera it
holds before the initial camera (the style's default) and nothing when the initial camera lands —
so camera changes are forwarded only once the map has loaded. Without the second, a restore left
the North button hidden and, 500 ms later, captured the style's default as the last camera.

### Capture and launch (`PROP-47`)

- **Store.** The map store gains `lastCamera: CameraFraming | null`, written by the camera-changed
  handler through a debounce, so it is written when the camera comes to rest. `partialize` adds
  `followMode` and `lastCamera`.
- **Validity.** A pure `lastCameraFault(camera, zoomRange)` returns why a stored camera cannot be
  restored (`non-finite`, `out-of-range`) or null: finite numbers, latitude in
  [-90, 90], longitude in [-180, 180], zoom inside the provider's range. Pitch and heading are not
  range-checked: the provider clamps pitch, and heading is an angle.
- **Launch resolution.** A pure `launchCamera(followMode, lastCamera, zoomRange)` returns one of
  `{ kind: 'follow', mode, from: camera }` (following, valid), `{ kind: 'follow', mode }` (following,
  no last camera: a first launch), `{ kind: 'restore', camera }` (free, valid) or
  `{ kind: 'follow', mode, invalid: <fault> }` (invalid, or free and missing; `mode` is the persisted
  one, `position` when free or when the follow state itself is unknown; the fault is `missing`,
  `unknown-follow-state` or the one `lastCameraFault` returned). It is
  computed once, from the hydrated state, and held for the session: `lastCamera` keeps changing after
  launch, the launch decision does not.
- **Applying it.** `restore` → `MapCanvas` passes the camera as `initialCamera`, follow stays off,
  and the store's `cameraPitch` and `cameraHeading` are seeded from it, so the declarative manual
  pitch (`pitch: cameraPitch` when follow is off) holds the restored tilt instead of flattening it,
  and the North button shows if the view was rotated. `follow` with `from` → the same camera is the
  `initialCamera`, `cameraHeading` is seeded from it, and rnmapbox's follow moves from there to the
  puck once a fix arrives. Pitch is not seeded: the follow mode sets its own (flat for position,
  tilted for position and heading), so a following launch tilts or flattens from the last camera's
  pitch as follow takes over, as a tap on the position button does today. Invalid → `mode` as
  above and one `logEvent('warn', 'map', 'persisted launch camera ignored', { reason })`, with no
  coordinate.

Until `PROP-48`, hydration may land after the first frame: the globe shows briefly, then the
initial camera jumps to the last camera. That is tolerated in this slice only.

### No globe frame (`PROP-48`)

The map mounts once the map store has hydrated, using zustand persist's own hydration signal
(`persist.hasHydrated()` / `onFinishHydration`), not a timer guess in a component. The native splash
is held (`expo-splash-screen`) until then. A bounded wait caps it: past the bound the map mounts on
the defaults (follow) and the debug log gets one `warn` line. The decision "hydrated or timed out"
is a pure, tested function. A launch that follows behaves exactly as today.

As built: `MapLaunchGate` (inside the map provider, around the app's navigator in the root layout)
waits on the gate, decides the launch camera, and renders its children only once
`launchResolved` is set; the root layout hides the splash on that flag. Wrapping the navigator
means everything under it waits too: the share-intent, resume-recording and offline-init handlers
start up to `MapTokens.hydrationBoundMs` later on a slow hydration. zustand persist reports a
storage error only through `onRehydrateStorage`, which records it on the store
(`hydrationError`), so a failure opens the gate at once instead of waiting out the bound
(`MapTokens.hydrationBoundMs`); the store records the error class only, since a parse error's
message can quote the stored payload. The map store's storage drops writes until hydration has
completed (`src/store/writesAfterHydration.ts`): zustand persist writes on every `set`, so otherwise
the defaults a failed or timed-out launch runs on would overwrite the stored style, trail selection
and last camera. A failed session therefore persists nothing. A hydration landing after a
timed-out launch still restores the style and trail selection, but the store's `merge` keeps the
session's follow state and last camera; writes resume from there.

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
- **`MapLaunchGate`** has one sibling: the root layout's database-migrations gate
  (`app/_layout.tsx`), which renders the app only once `useDatabaseMigrations` succeeds and hides
  the splash on its outcome. Same shape (async readiness → render children, release the splash),
  reused as is: `MapLaunchGate` nests inside it and the layout hides the splash on either flag. Not
  extracted: the migrations gate has no bound and blocks on failure, this one opens on both.
- **`hydrationGate`, `useLastCameraCapture` and `writesAfterHydration`:** none. No other pure
  readiness decision, no other debounced capture of a native event into a store, and the only other
  persisted store (`preferencesStore`) writes on user action alone, so it has no session-start
  write to keep from storage.
- **Extracted to be shared:** `CameraFraming`, used by the camera-changed event, the initial camera
  and the stored last camera, so the three can't drift.

## Failure modes

- **Invalid last camera** (corrupt storage, a value from an older shape): ignored, one `warn` line;
  a free launch follows in position mode, a following one follows in its mode from the provider's
  default camera. The next rest overwrites it.
- **Unknown follow state** (corrupt storage, an older shape): ignored, launch follows in position
  mode, one `warn` line. The next follow change overwrites it.
- **Missing last camera with a free follow state** (killed after a gesture but before the first
  rest was captured, or the first launch after upgrading): same as invalid.
- **Stale last camera** (killed mid-pan, before the debounce fires): the previous rest is restored.
  It is still a framing the user had; accepted.
- **Hydration fails** (AsyncStorage error or a corrupt payload): zustand persist keeps the
  defaults, launch follows as today. After `PROP-48` the gate opens on the failure and logs one
  `warn` line with the error class. Nothing is written for the rest of the session, so storage
  still holds what it held. A corrupt payload therefore keeps failing every launch until storage is
  cleared.
- **Hydration slow or never completes:** before `PROP-48`, a brief globe frame then the jump.
  After it, the splash holds up to the bound, then the map mounts on the defaults with one `warn`
  line. The app is never held. Nothing is written until the hydration lands, if it ever does.
- **No location permission or no position yet:** a free launch is unaffected, the restored camera
  needs no position. A following launch sits on the last camera until a fix arrives (no puck,
  nothing to follow).
- **Restored trail selection with a free camera:** overlay and info card shown, no fit
  (`pendingFit` stays null); the camera sits on the last camera, which is typically the framing the
  user left on that trail.
- **Render-time throw:** none new. The resolution and predicate are total over their inputs; the
  adapter's translation is the only native contact and is device-verified.

## Testing

**Pure logic (Jest, TDD):** `lastCameraFault` (finite, lat/lng range, zoom range edges, NaN,
Infinity); `launchCamera` (following in each mode from a valid last camera, following + missing,
following + invalid, free + valid, free + invalid, free + missing);
`partialize` includes `followMode` and `lastCamera` and still excludes `pendingFit`; the hydration
gate's decision (hydrated, failed, timed out).

**Device-verified (the owner's step):** pan, tilt and rotate, kill, relaunch → same framing, no
globe frame (after `PROP-48`). Following at kill → relaunch opens on the last camera, no globe
frame, then moves to the user. Kill with the
save-activity screen open while free → the map comes back on the last camera. North button still
appears and resets.

## Docs

`GLOSSARY.md` already defines Follow, Free camera and Last camera. The 2026-08-21 spec carries a
pointer to ADR 0003 where it keeps the camera session-only.
