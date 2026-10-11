# Activity Recording — Slice Breakdown

> **Status:** brainstorm in progress. This is the umbrella plan for the "record the
> user's trail as they move" feature. It is intentionally split into independently
> shippable slices, each of which gets its own full brainstorm → spec → plan → SDD
> cycle and is device-verified before the next begins. Only slice 1 is fully designed
> so far; slices 2–3 are designed just-in-time.

## The feature (user's original request)

- A **play** button at the bottom-left of the map starts recording the user's live GPS trail.
- While recording, it becomes a **stop** button that must be **press-and-held** to stop.
- On stop, the user is taken to a **new page** to name the activity, define the **effort**,
  add **comments**, and save it.
- If an activity was recorded while a **trail was displayed**, the two are **linked** — later,
  opening the activity lets the user navigate to the connected trail.
- If the app is **closed during recording** and reopened, recording **resumes seamlessly**.
- A **displayed trail** must also persist across close/reopen. General rule: on close, save
  whether a trail was displayed (and which); on open, restore it. If no trail was displayed,
  save that none was.

## Locked decisions (from brainstorming)

- **Recording mode = background tracking** (real hikes). Uses `expo-location`'s background
  updates via a `TaskManager` task + an **Android foreground service** (persistent
  "On Foot is recording" notification) + `ACCESS_BACKGROUND_LOCATION`. GPS keeps logging with
  the app backgrounded / screen off. Requires a **clean prebuild** and a runtime permission
  prompt. (`watchPositionAsync` is foreground-only and was rejected.)
- **Restore-camera behavior (slice 1) = "follow me, trail overlaid."** On reopen with a
  restored trail: show the trail overlay + info card, but keep the camera following the
  user's live position (default launch behavior) — do **not** re-fit the camera to the trail.
  The one-shot fit stays reserved for a real user tap.

## Slices (build in this order)

### Slice 1 — Restore-last-map-state (foundational, small) — DESIGNED
Persist which trail is displayed (or that none is) across close/reopen; restore on launch
with overlay + info card, camera following the user.

- **Persist the minimum:** add `selectedTrailId` (`number | null`, null = "none displayed")
  to the map store's `partialize` (today only `mapStyleId`). Rides the existing AsyncStorage
  persist middleware; `followMode` stays unpersisted.
- **Split "trail is selected" from "fit camera to it":** today `selectTrail` conflates
  id + `followMode:'off'` and the fit is keyed on trail identity (`MapCanvas` `[trail]`),
  so a restored trail would wrongly fit. Add a session-only `trailFitNonce` (mirrors
  `northResetNonce`); `selectTrail` bumps it; `MapCanvas`'s fit effect keys on the nonce.
  Restore rehydrates `selectedTrailId` only → overlay+card show, `followMode` stays default
  `'position'`, nonce stays `0` → no fit → camera follows the user.
- **Self-heal a deleted trail:** `useSelectedTrail` already returns null if the persisted id
  no longer exists; additionally call `clearSelectedTrail()` in that case so the stale id
  doesn't persist forward.
- **Testing:** TDD in `mapStore.test.ts` (`selectTrail` sets id + `followMode:'off'` + bumps
  nonce; `clearSelectedTrail` nulls id; `partialize` includes `selectedTrailId`).
  Device-verify: display trail → kill → reopen → overlay+card restored, camera following;
  close with no trail → reopen → clean map.

### Slice 2 — Record & save an activity (the heart) — NOT YET DESIGNED
The play → hold-to-stop button on the map; live GPS capture that survives an app kill; the
save page (name / effort / comments); a new `activities` table; and linking to the displayed
trail.

- Background location task + foreground service (see locked decision).
- In-progress track must be durably persisted point-by-point (so a kill loses at most the
  gap while the app was dead, then resumes) — persistence-seam question to design.
- Press-and-hold to stop → navigate to the save page → write the activity.
- Capture `linkedTrailId` = the `selectedTrailId` at record time, if any.
- Location access stays behind the map/location seam; only provider/native code touches SDKs.

### Slice 3 — Activities list & detail (consume the data) — NOT YET DESIGNED
The Activities tab lists saved activities; tapping one shows it (on the map / detail view)
and offers navigation to its linked trail.

- Replace the `app/(tabs)/activities.tsx` placeholder.
- Render the recorded activity track; "View linked trail" affordance when `linkedTrailId` set.

## Guardrails (from AGENTS.md — apply to every slice)

- No quick-fixes; fix root cause at the right layer.
- Map-provider seam inviolable (only `src/map/providers/<provider>/` imports a map SDK);
  persistence seam (only `src/data/db/*` imports expo-sqlite/drizzle-orm).
- Small single-purpose units; pure logic TDD'd, native rendering device-verified.
- Persist the minimum.
- Each slice: brainstorm → spec → plan → SDD, device-verified before the next.
