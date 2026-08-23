# Slice 3 — Activities: list, view-on-map, linked trail

**Date:** 2026-08-23
**Status:** Design approved
**Umbrella spec:** `2026-08-21-onfoot-rn-activity-recording-slices.md` (Slice 3)

## Goal

Let the user browse saved activities and see any one of them on the map, with its
full record and a way to reach the trail it was linked to. This closes the
record→save→review loop opened by Slices 1 and 2.

## Core principle: one map, explicit modes

The Map tab is the **only interactive map in the app**. It shows exactly one thing
at a time, and its mode is **derived** from state (never a stored flag that could
drift from reality — same discipline as `recordingPhase(session)`).

| Mode | Trigger (derived) | Record button | Indicator |
|---|---|---|---|
| **Free** | nothing selected, no session | ● start | — |
| **Trail** | trail selected | ● start (links to trail on stop) | bottom `TrailInfoCard` *(unchanged)* |
| **Recording** | active recording session | ■ hold-to-stop | the hold-to-stop button itself |
| **Activity** (new) | activity selected | **hidden** | top chip + expandable bottom sheet |

Rules:

- **Mutually exclusive.** Selecting an activity clears any displayed trail (→ Activity
  mode). "View linked trail" clears the activity (→ Trail mode). Only one is ever drawn.
- **Recording wins.** While a recording session is active, selection is not offered /
  ignored; the recording UI takes precedence. (In practice the user is on the map
  recording; the Activities list still navigates, but recording mode continues to own
  the map. Entering Activity mode is only possible when not recording.)
- **Activity mode hides the record button.** Viewing the past is read-only for
  recording. The richer "convert to trail / record anyway" flow is a future feature
  (see Out of scope); for now, exit Activity mode (✕) to record again.

A pure `mapMode(...)` selector derives the mode from `{ session, selectedActivityId,
selectedTrailId }`, with recording taking precedence, then activity, then trail, then free.

## The activity on the map (no dedicated screen)

Tapping an activity does **not** open a separate page. It puts the activity on the
single map, in Activity mode, composed of independent overlay layers:

1. **Top chip** — `Viewing activity · {name}   ✕`, in a distinct activity accent
   color. The ✕ exits to Free mode (`clearSelectedActivity`). Anchored at the top of
   the map, clear of the safe-area inset.

2. **Expandable bottom sheet** (`@gorhom/bottom-sheet`, already used by the layers
   sheet), presented while in Activity mode:
   - **Collapsed** (summary banner): name, effort badge, `distance · duration`, date.
   - **Expanded** (full record): distance / duration / elevation gain / loss, effort,
     start–end times, comments, and **"View linked trail"** — shown only when
     `linkedTrailId` is set *and* that trail still exists.
   - The sheet owns **only the record**. It is not the parent of anything else that
     floats over the map (see Future-proofing).

3. **Track overlay** — the recorded geometry drawn via the existing `TrailOverlay`
   port with **start/end endpoint markers, no direction arrows**, in a new
   `activityLine` theme color (distinct from trail purple and recording orange). This
   requires making the port's arrow-related props **optional** so the same component
   renders a trail (with arrows) or an activity (without). Camera fits the whole track
   on entry (reusing the existing pending-fit mechanism, generalized to activities).

## Activities tab (a launcher list)

`app/(tabs)/activities.tsx` replaces the placeholder with a list mirroring the Trails
tab:

- `FlatList` of `ActivitySummary`, **newest first** (already the repository's order:
  `orderBy(desc(startedAt))`). Reloaded on focus (`useFocusEffect`).
- Each card (`ActivityListItem`, mirroring `TrailListItem`): thumb icon, name, an
  **effort badge** (`EffortBadge`, mirroring `DifficultyBadge` and reusing `effort.ts`),
  a one-line `distance · duration` summary, the date, and a **delete** icon.
- **Tap a card** → `selectActivity(id)` then navigate to the Map tab (`router.navigate('/')`),
  exactly as tapping a trail does.
- **Delete** → confirm dialog (mirroring trail delete) → `removeActivity(id)`. If the
  deleted activity is the one currently displayed on the map, the map clears it.
- Empty state: "No activities recorded yet." (matching the Trails empty state).

## State & data

### Map store (`src/store/mapStore.ts`)
- Add session-only **`selectedActivityId: number | null`** (NOT persisted — viewing an
  activity is transient; on relaunch the map returns to Free, or resumes recording,
  which always wins).
- Add **`selectActivity(id)`** (sets `selectedActivityId`, clears `selectedTrailId`,
  turns follow off, sets a pending camera fit) and **`clearSelectedActivity()`**.
- **`selectTrail(id)`** additionally clears `selectedActivityId` (mutual exclusion).
- **Generalize the pending-fit mechanism**: replace `pendingFitTrailId: number | null`
  with `pendingFit: { kind: 'trail' | 'activity'; id: number } | null`, and
  `clearPendingFit()`. The trail path in `MapCanvas` is updated accordingly. This is a
  deliberate, complete refactor (not a fork of the pattern).
- Add pure exported **`mapMode(input)`** selector.

### Persistence seam (`src/data/activities/` + `src/data/db/`)
- Add **`deleteActivity(id: number): Promise<void>`** to the `ActivitiesRepository`
  port and its SQLite implementation (single-row delete from `activities`; geometry is
  a JSON column on that row, so no child cleanup and **no migration** needed).

### Activities store (`src/store/activitiesStore.ts`)
- Add **`removeActivity(id)`** (calls `deleteActivity`, then `loadActivities`).

### Hook (`src/map/`)
- **`useSelectedActivity(): Activity | null`** mirrors `useSelectedTrail` — loads the
  full `Activity` (with geometry) via `activitiesRepository.getActivity` when
  `selectedActivityId` is set; clears the selection if it no longer exists.

### Map screen (`src/map/MapScreen.tsx`)
- Compose the new layers: derive `mapMode`; render the top chip + activity bottom sheet
  + activity track overlay when in Activity mode; keep the existing `TrailInfoCard` for
  Trail mode; hide the record button in Activity mode.

## Future-proofing (constraint now, feature later)

A future feature will add an **interactive elevation graph** that lives **above the
sheet**, over the map, always live (tap the graph → drop a marker on the map at that
point). There will be **one** graph, not a duplicated copy inside the sheet.

The only thing this slice does to accommodate it is a **layout discipline**, not a
feature:

> The map's overlay region is a **vertical stack of independent, mode-driven layers**
> (top chip → *reserved above-sheet slot* → bottom sheet), NOT one monolithic sheet
> that owns everything. The activity sheet contains **only the record**; the sheet's
> top edge is a boundary other map layers may sit above. No graph component, no
> elevation-interaction code, and no marker data model are built now.

This costs nothing today and prevents a later refactor to crack open a monolithic sheet.

## Testing

- **Pure logic, TDD (Jest, tests first):** `mapMode` selector; the new `mapStore`
  actions and the generalized `pendingFit` behavior; any new date/summary formatter.
- **Device-verified (not unit-tested):** the track overlay rendering, the top chip, the
  bottom-sheet expand/collapse, camera fit, and navigation between modes.

## Out of scope (explicitly deferred)

- **Convert activity → trail + follow** (the future answer to "walk this route again";
  the flat activity→trail-only linkage is preserved for it — activities may point at a
  trail, trails never point back, no activity→activity edges).
- **Elevation graph** and the **tap-to-place-marker** interaction / marker data model.
- **Trail-creation mode** (a future map mode that also hides the record button).
- **Photos** on activities.
- Unifying the trail info card into the same bottom-sheet pattern (Trail mode keeps its
  simpler static `TrailInfoCard` for now; the two modes are not visually identical yet).
- Elevation-noise smoothing (its own deferred slice); the recorded elevation gain/loss
  is shown as-is.

## Guardrails (from AGENTS.md)

- No quick-fixes; fix root cause at the right layer.
- Map-provider seam inviolable — only `src/map/providers/<provider>/` imports a map SDK;
  new provider concepts (optional arrow props on the overlay) are declared on the port.
- Persistence seam — only `src/data/db/*` imports expo-sqlite / drizzle-orm.
- Small, single-purpose units; pure logic TDD'd, native rendering device-verified.
- Persist the minimum — `selectedActivityId` is session-only.
