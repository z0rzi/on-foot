# Trails — Add-a-GPX vertical slice: Design

**Status:** approved (brainstorm)
**Date:** 2026-08-20
**Scope:** first vertical slice of the trails subsystem (spec Phases 3–5, sliced).

## Goal

Turn the empty Trails tab into a working, persisted feature: import a GPX file
(via a bottom button **or** the OS "open with" association), review its computed
metrics, name/classify/describe it, save it, and see it in a list. Faithful in
behaviour and copy to the Kotlin `on-foot` app; free in implementation, within the
project's architecture rules.

## Scope

**In this slice**
- Bottom full-width **"Add a GPX file"** button on the trails list.
- OS **file-open association** for GPX → routes to the same add-GPX form.
- Add-GPX **form**: parse GPX → show read-only metrics → name (required) +
  difficulty (required) + description (optional) → save.
- **Persistence** via expo-sqlite + Drizzle behind a repository seam.
- **Trails list**: cards (icon placeholder, name, difficulty badge, metrics) +
  per-card delete with confirmation; empty state.

**Deferred (later slices, must not be precluded)**
- Photos (picker, storage, thumbnails).
- Edit mode; card-tap "show on map"; the map trail overlay + camera-fit.
- Waypoint rendering.

These are omitted rather than stubbed as dead UI. The DB stores the trail
**geometry** now (JSON column) so the map-overlay slice needs no migration for it.

## Architecture & module layout

Persistence gets a seam mirroring the map-provider seam: only `src/data/db/*`
imports the engine (`expo-sqlite`/`drizzle`); the store and UI depend on an
engine-agnostic repository interface.

```
src/data/
  db/
    client.ts        expo-sqlite/Drizzle handle + migrate(); ONLY engine import site
    schema.ts        Drizzle table definition(s)
    migrations/…     drizzle-kit generated
  trails/
    types.ts         engine-free domain types
    repository.ts    TrailsRepository interface (PORT) + SQLite-backed impl
    gpx/
      parse.ts       pure: (xml: string, fallbackName?) → GpxParseResult   (TDD)
      metrics.ts     pure: points → metrics + formatters                   (TDD)
    __tests__/       parse + metrics (+ repository/mapping) tests
src/store/
  trailsStore.ts     Zustand cache over the repository (load/add/delete)
src/trails/          presentational components (TrailListItem, DifficultyBadge,
                     MetricsRow, DifficultySelector)
app/(tabs)/trails.tsx  list screen (rewritten from placeholder)
app/trail/new.tsx      add-GPX form (stack route pushed over the tabs)
```

**Seam rule:** the repository interface is engine-agnostic. Swapping engines or
unit-testing with a fake repo touches one folder. No Drizzle/SQLite type leaks
past `src/data/`.

**Why `trailsStore`:** reactive list updates when the form saves; matches the
existing Zustand pattern. It is a thin cache — SQLite is the source of truth, so
it persists nothing (`partialize` stays empty for it).

## Data model & persistence

Single table this slice (`trails`). Points are never queried individually and
photos/waypoints are deferred, so the polyline is a JSON column.

`src/data/db/schema.ts` — `trails`:

| column | type | notes |
|---|---|---|
| `id` | integer PK autoincrement | |
| `name` | text not null | |
| `difficulty` | text not null | `'easy' \| 'medium' \| 'hard'` |
| `distanceMeters` | real not null | computed at import |
| `elevationGainMeters` | real not null | |
| `elevationLossMeters` | real not null | |
| `description` | text nullable | |
| `geometry` | text not null | JSON `{ points: GpxPoint[]; waypoints: GpxWaypoint[] }` |
| `createdAt` | integer not null | epoch ms |
| `updatedAt` | integer not null | epoch ms |

Deferred columns/tables (photos, waypoints) arrive later via drizzle-kit
migrations — the reason we adopt drizzle-kit now.

`src/data/trails/types.ts` (engine-free):

```ts
export interface GpxPoint { lat: number; lng: number; ele: number | null }
export interface GpxWaypoint {
  lat: number; lng: number; ele: number | null
  name: string | null; description: string | null
}
export type Difficulty = 'easy' | 'medium' | 'hard'
export interface TrailMetrics {
  distanceMeters: number; elevationGainMeters: number; elevationLossMeters: number
}
export interface TrailGeometry { points: GpxPoint[]; waypoints: GpxWaypoint[] }
export interface NewTrailInput {
  name: string; difficulty: Difficulty; description: string | null
  metrics: TrailMetrics; geometry: TrailGeometry
}
export interface TrailSummary {   // list-card fields, no geometry (cheap reads)
  id: number; name: string; difficulty: Difficulty
  metrics: TrailMetrics; createdAt: number
}
export interface Trail extends TrailSummary {  // full row
  description: string | null; geometry: TrailGeometry; updatedAt: number
}
```

`src/data/trails/repository.ts` — PORT:

```ts
export interface TrailsRepository {
  listSummaries(): Promise<TrailSummary[]>       // newest first
  getTrail(id: number): Promise<Trail | null>
  createTrail(input: NewTrailInput): Promise<number>   // returns new id
  deleteTrail(id: number): Promise<void>
}
```

The SQLite impl is built with the Drizzle client from `src/data/db/client.ts` and
owns geometry JSON (de)serialization so it never leaks past the repo.

**Migrations:** drizzle-kit generates SQL; the app applies them on startup via a
`migrate()` call wired into the root layout before any DB use. Exact expo-sqlite +
Drizzle migration API confirmed against the v57 docs at implementation time.

## Pure logic (GPX parse + metrics)

**`gpx/parse.ts`** — faithful TS port of Kotlin `GpxParser`, pure (string in,
structured out), parsed with **`fast-xml-parser`** (pure-JS, RN-safe):
- If any `<rte>` exists → use route points, ignore tracks; else use `<trk>` track
  points. Merge segments in document order.
- Always collect `<wpt>` waypoints.
- Title precedence: `<trk><name>` → `<metadata><name>` → `fallbackName`.
- Namespace-prefixed tags normalized by local name (`<gpx:ele>` → `ele`).
- Missing `lat`/`lon` on a point → throw (invalid GPX). Empty/self-closing text
  elements tolerated (→ null).

Returns `GpxParseResult { points: GpxPoint[]; waypoints: GpxWaypoint[]; title: string | null }`.

**`gpx/metrics.ts`** — port of `TrailMetricsCalculator`, pure:
- `computeMetrics(points): TrailMetrics`. Distance via **Haversine**
  (`Location.distanceBetween` is unavailable in RN). Gain/loss summed only across
  segments where both endpoints have elevation. Empty/one-point list → zeros.
- `formatDistance(m)`: `>= 1000` → `"%.1f km"`, else `"%.0f m"`.
- `formatElevation(m)`: `"%.0f m"`.

## Entry points & navigation

Both doors converge on one shared import path (read URI bytes → parse → form) so
they can't drift.

**Door A — button.** Full-width "Add a GPX file" at the bottom of the list
(safe-area aware, above the tab bar). Launches `expo-document-picker` filtered to
GPX (`application/gpx+xml` + `application/octet-stream`/`*/*` fallbacks, mirroring
the Kotlin picker since providers mislabel GPX). On pick →
`router.push({ pathname: '/trail/new', params: { uri, name } })`.

**Door B — OS "open with".** Register as a GPX handler via Android
`android.intentFilters` in `app.config` (`VIEW` action, `DEFAULT`/`BROWSABLE`
categories, data matching `.gpx` / `application/gpx+xml` over `content`/`file`
schemes). Incoming URI arrives via `expo-linking`: `Linking.getInitialURL()`
(cold) and the `url` event (warm). A handler in the root layout detects a GPX URI
and routes to the same form. Requires a native rebuild; exact v57 intent-filter +
linking APIs confirmed at implementation time.

**Navigation.** Form is a stack route `app/trail/new.tsx` pushed over the tabs,
with its own header + back arrow (like Kotlin `TrailFormScreen`). File reading
uses `expo-file-system` (handles `content://`). On successful save →
`router.back()`; the list re-reads from the store.

**Verification caveat:** Door B exists only after a native rebuild + install, so
it is a device-rebuild verification step; Door A works immediately in Metro.

## UI

**Trails list** (`app/(tabs)/trails.tsx`) — faithful to `TrailsListScreen` minus
deferred bits:
- Header "Trails". Empty state: centered "No trails saved yet."
- Cards: hiking-icon placeholder (no thumbnails), **name**, **difficulty badge**
  (easy = accent, medium = tertiary, hard = error, from theme tokens),
  `"5.2 km • 250 m gain"`. Per-card **delete** with a confirmation dialog
  ("Delete Trail" / "…cannot be undone.", matching Kotlin copy).
- Bottom full-width **"Add a GPX file"** button.
- **Omitted this slice** (return with later slices, not stubbed): edit button;
  card-tap "show on map" (card tap inert).

**Add-GPX form** (`app/trail/new.tsx`) — faithful to `TrailFormScreen`
create-mode:
- Header with back arrow. Centered spinner while parsing.
- Read-only **metrics row**: Distance / Elevation Gain / Elevation Loss.
- **Name** (required; prefilled from parsed title / file name).
- **Difficulty** selector (required; easy/medium/hard).
- **Description** (optional, multiline).
- Bottom **"I'm done"** button, enabled only when name + difficulty set and not
  saving; on tap persists via repository → returns to list.
- Read/parse errors surface a message and send the user back (no half-saved trail).

Presentational pieces (`TrailListItem`, `DifficultyBadge`, `MetricsRow`,
`DifficultySelector`) live in `src/trails/`, themed via existing `useTheme`/tokens.
Any needed difficulty/badge colors are added to theme tokens, not inlined.

## New dependencies

- `fast-xml-parser` — GPX parsing (pure JS)
- `expo-document-picker` — Door A picker  *(native rebuild)*
- `expo-file-system` — read picked/opened URI  *(native rebuild)*
- `expo-sqlite` + `drizzle-orm` (runtime) + `drizzle-kit` (dev)  *(native rebuild)*

## Testing

- **Pure logic, TDD first:** `parse.ts` vs a GPX fixture corpus (track-only,
  route-over-track, waypoints, namespaced tags, missing-ele tolerated, missing-lat
  throws, title precedence, fallback name); `metrics.ts` (Haversine on known
  coords, gain/loss with elevation gaps, empty → zeros, both formatters).
- **Repository:** round-trip `createTrail`→`getTrail` (geometry JSON survives),
  `listSummaries` excludes geometry, `deleteTrail`. If the expo-sqlite native
  module can't load under jest-expo, fall back to testing the pure mapping/
  serialization layer and verify the round-trip on-device (decided at
  implementation time, noted in the plan).
- **Store:** `trailsStore` load/add/delete against a fake repository.
- **Device-verified:** Door A picker→form→save→list; migration-on-startup; Door B
  file-open after a native rebuild.

## Architecture-rule compliance

- Persistence seam: engine confined to `src/data/db/*`; UI/store use the port.
- Pure logic TDD'd; native/rendering device-verified.
- Small single-purpose units; split by responsibility.
- Persist the minimum: SQLite is the source of truth; `trailsStore` persists
  nothing.
- No dead UI: deferred controls omitted, not stubbed.
