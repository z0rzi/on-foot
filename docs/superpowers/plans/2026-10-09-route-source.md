# Route Source Discriminator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close DUP-10 (two functions decide which route is on screen) and DUP-9 (the port's two route-line components, only one of which can show slope).

**Architecture:** `RouteDisplay` gains a `kind` discriminator naming what it was derived from, so the colouring can be routed to the matching overlay instead of re-deciding. The port's `TrailOverlay` and `RouteLine` then collapse into one `RouteOverlay`, since the second is a feature subset of the first.

**Tech Stack:** TypeScript 6, React 19, Jest 29 via jest-expo, @rnmapbox/maps behind the port at `src/map/provider/`.

**Spec:** `docs/superpowers/specs/2026-10-09-route-source-design.md`

## Global Constraints

- **Tasks 1 and 2 must not change a single pixel.** Only Task 3 changes what is drawn, and only in one case: a recording with no trail selected.
- **Do not reintroduce PERF-2.** `useRouteDisplay`'s two-stage memo exists because the first stage re-runs on every GPS fix and the second must not. The second memo keys on the **parts** (`kind`, `segments`), never on the source object. Task 1 explains this in full; getting it wrong restores a regression this project already caught once (`0e0b7d7`).
- **Every Mapbox layer id must stay byte-identical** after Task 2. The prefixes `'trail'` and `'route'` are chosen precisely so nothing changes.
- The map SDK stays confined to `src/map/providers/` — the seam test enforces it. Shared code talks to the port.
- NO JSDoc. Comments explain *why*, never what changed. Do not add a comment narrating the refactor; do keep and update the existing *why* comments where the code they explain moves.
- Commit subjects: lowercase, conventional-commit prefix, ONE line, no body.
- Baseline, measured: **70 suites / 581 tests**. Each task states its expected delta; derive the real number by running.
- Device checks are the controller's job, not yours. Do not attempt `adb`.

---

### Task 1: the source discriminator

**Files:**
- Modify: `src/elevation/routeDisplay.ts`, `src/map/profileSource.ts`, `src/map/useRouteDisplay.ts`
- Test: `src/map/__tests__/profileSource.test.ts`, `src/elevation/__tests__/routeDisplay.test.ts`

**Interfaces:**
- Produces: `RouteSource = 'trail' | 'activity' | 'live'` and `RouteDisplay.kind`, both from `src/elevation/routeDisplay.ts`; `profileSourceFor(mode, trail, activity, livePoints): { kind: RouteSource; segments: ElePoint[][] } | null` from `src/map/profileSource.ts` (replacing `profileSegmentsFor`). `routeDisplay` takes `kind` as its new first parameter. Tasks 2 and 3 consume `RouteSource` and `RouteDisplay.kind`.

- [ ] **Step 1: Update the two test files first**

In `src/map/__tests__/profileSource.test.ts`, rename to `profileSourceFor` throughout and assert the discriminator on every case. The seven existing cases keep their inputs; only the expected shape changes. For example:

```ts
  it('returns the trail segments in trail mode', () => {
    const trail = trailWith([[{ lat: 0, lng: 0, ele: 1 }]])
    expect(profileSourceFor('trail', trail, null, [])).toEqual({
      kind: 'trail',
      segments: trail.geometry.segments,
    })
  })
```

Then add the guard that protects the performance fix — this one is not optional and must assert **reference identity**, not deep equality:

```ts
  it('returns the followed trail segments by reference, so the display memo holds across fixes', () => {
    const trail = trailWith([[{ lat: 0, lng: 0, ele: 1 }]])
    const first = profileSourceFor('recording', trail, null, [livePoint(0, 1)])
    const second = profileSourceFor('recording', trail, null, [livePoint(0, 1), livePoint(0, 2)])
    expect(first?.segments).toBe(trail.geometry.segments)
    expect(second?.segments).toBe(first?.segments)
  })
```

Two different `livePoints` arrays, the same segments reference out — that is exactly the property `useRouteDisplay`'s second memo depends on.

In `src/elevation/__tests__/routeDisplay.test.ts`, add `kind` as the first argument to every `routeDisplay(...)` call, and add one case asserting it is carried through:

```ts
  it('carries the source kind through to the display', () => {
    expect(routeDisplay('live', [seg([100, 120, 140])], 0)?.kind).toBe('live')
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/map/__tests__/profileSource.test.ts src/elevation/__tests__/routeDisplay.test.ts`
Expected: FAIL — `profileSourceFor` is not exported, and `routeDisplay`'s arity is wrong.

- [ ] **Step 3: Add the discriminator to the display**

In `src/elevation/routeDisplay.ts`:

```ts
export type RouteSource = 'trail' | 'activity' | 'live'
```

Add `kind: RouteSource` as the first field of `RouteDisplay`, and change the function:

```ts
export function routeDisplay(
  kind: RouteSource,
  segments: ElePoint[][] | null,
  smoothingMeters: number,
): RouteDisplay | null {
  if (!segments) return null
  const profile = buildElevationProfile(segments)
  if (!profile) return null
  return { kind, profile, ...displaySlopeBands(profile, smoothingMeters) }
}
```

Extend the existing block comment above `RouteDisplay` to say what `kind` is for — which route this view describes — in the same voice as the rest of it. Do not write a comment about the change.

- [ ] **Step 4: Name the choice in `profileSource.ts`**

Rename `profileSegmentsFor` to `profileSourceFor` and return the tagged pair. The mode branches must stay behaviourally identical, including that recording-with-a-trail returns `trail.geometry.segments` itself:

```ts
export function profileSourceFor(
  mode: MapMode,
  trail: Trail | null,
  activity: Activity | null,
  livePoints: LiveTrackPoint[],
): { kind: RouteSource; segments: ElePoint[][] } | null {
  if (mode === 'trail') return trail ? { kind: 'trail', segments: trail.geometry.segments } : null
  if (mode === 'activity') {
    return activity ? { kind: 'activity', segments: activity.geometry.segments } : null
  }
  if (mode === 'recording') {
    return trail
      ? { kind: 'trail', segments: trail.geometry.segments }
      : { kind: 'live', segments: groupPointsBySegment(livePoints) }
  }
  return null
}
```

Note the one behaviour to preserve exactly: in recording mode with no trail and no live points, the old code produced `[]` (not `null`), and `routeDisplay` then returned `null` because the profile could not be built. The new code does the same. Do not "improve" this into an early `null`.

- [ ] **Step 5: Key the second memo on the parts, not the object**

This is the step that protects the performance fix. In `src/map/useRouteDisplay.ts`:

```ts
  const source = useMemo(
    () => profileSourceFor(mode, trail, activity, livePoints),
    [mode, trail, activity, livePoints],
  )
  const kind = source?.kind ?? null
  const segments = source?.segments ?? null
  return useMemo(
    () => (kind ? routeDisplay(kind, segments, smoothing) : null),
    [kind, segments, smoothing],
  )
```

`source` is a **new object on every GPS fix** — the first memo's deps include `livePoints`. Keying the second memo on `source` would therefore re-run the profile and banding pass per fix, which is the regression `0e0b7d7` fixed. Keying on `kind` (a string) and `segments` (a stable reference while a trail is followed) holds exactly as today.

Update the existing block comment above the hook so its explanation of the two-stage memo still matches the code — it already explains why the split exists; it now also needs to say why the second stage takes the parts rather than the pair.

If `react-hooks/exhaustive-deps` objects to the second memo's dependency list, do not reshape the code to satisfy it: this is the deliberate-exception case AGENTS.md describes. Add an `eslint-disable-next-line` with a one-line justification naming the per-fix re-run being avoided. Report whether this was needed.

- [ ] **Step 6: Fix the call sites that no longer compile**

`routeDisplay`'s arity changed and `profileSegmentsFor` is gone. Run `npx tsc --noEmit` and fix what it names. Expect `useRouteDisplay.ts` only — but check, and report anything else.

Consumers that merely *read* a `RouteDisplay` (`ElevationGraph`, the three info sheets, `MapCanvas`, `useRouteColouring`) take a new field additively and must not need edits. If one does, stop and report.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx jest src/map src/elevation`
Expected: PASS, including every pre-existing case.

- [ ] **Step 8: Verify and commit**

Run: `npm run verify` — expected green at **70 suites / 583 tests**.

```bash
git add src/elevation src/map
git commit -m "feat(map): name which route the elevation view was derived from"
```

---

### Task 2: one overlay component at the port

**Files:**
- Modify: `src/map/provider/types.ts`, `src/map/providers/mapbox/adapter.tsx`, `src/map/MapOverlays.tsx`

**Interfaces:**
- Produces: `RouteOverlayProps` and `MapComponents.RouteOverlay`, replacing `TrailOverlayProps`/`RouteLineProps` and `MapComponents.TrailOverlay`/`.RouteLine`. Task 3 passes `colouredLines` into it.

**This task must not change a single pixel.** Every Mapbox layer id, every style value, and the z-order all stay as they are.

- [ ] **Step 1: Replace the two prop types with one**

In `src/map/provider/types.ts`, delete `TrailOverlayProps` and `RouteLineProps` and add:

```ts
export interface RouteOverlayProps {
  // Layer-id prefix, so two overlays can coexist on one map.
  idPrefix: string
  // Track segments as a MultiLineString: each entry is one segment's [lng, lat] pairs, in order.
  lines: [number, number][][]
  // Dashed connectors bridging consecutive segment endpoints; carry no distance.
  connectors: [number, number][][]
  connectorDashArray: number[]
  color: string
  lineWidth: number
  // When set, per-slope coloured polylines drawn instead of the single-colour `lines` (each
  // carries its own colour; the adapter draws them with a data-driven line colour). Stays
  // provider- and slope-agnostic: shared code maps slope band → colour before it reaches here.
  colouredLines?: ColouredLine[]
  // An outline drawn under the line to lift it off the map. The route carries one; the live
  // track, which sits above the route, does not.
  casing?: boolean
  // Directional arrows are optional: omit arrowImage to render a plain line (used for recorded
  // activity tracks, where arrows on noisy GPS look cluttered, and for the live track).
  arrowImage?: number
  arrowSpacing?: number
  arrowSize?: number
  // [start, end] as [lng, lat] drawn as dot markers, with their styling. One optional unit so the
  // feature cannot be half-configured.
  endpoints?: {
    points: [number, number][]
    radius: number
    strokeColor: string
    strokeWidth: number
  }
}
```

In `MapComponents`, replace the `TrailOverlay` and `RouteLine` entries with:

```ts
  RouteOverlay: React.ComponentType<RouteOverlayProps>
```

- [ ] **Step 2: Merge the two adapter components into one**

In `src/map/providers/mapbox/adapter.tsx`, rewrite `TrailOverlay` as `RouteOverlay` taking the new props, and **delete `RouteLine` entirely**. Rules:

- Every hardcoded `trail-` id becomes `` `${idPrefix}-…` ``. The ids keep their existing suffixes exactly: `-slope-source`, `-slope-casing`, `-slope-line`, `-arrows`, `-line-source`, `-line-casing`, `-line`, `-connector-source`, `-connector`, `-endpoints-source`, `-endpoints`.
- The casing layers (`-slope-casing` and `-line-casing`) render only when `casing` is true.
- The endpoints `ShapeSource`/`CircleLayer` renders only when `endpoints` is provided, reading its four values from that object.
- Keep `TRAIL_CASING` and every style value exactly as they are.
- Register it in the provider's `components` map as `RouteOverlay`, replacing both old entries.

Mapbox requires unique layer ids within a map. With `idPrefix` of `'trail'` and `'route'` the resulting ids are exactly today's, so two overlays never collide — but if you change a suffix, they will. Do not change the suffixes.

- [ ] **Step 3: Update the only consumer**

In `src/map/MapOverlays.tsx`, use `RouteOverlay` for both. The route overlay keeps every value it passes today, plus `idPrefix="trail"`, `casing`, and its endpoints grouped:

```tsx
        <RouteOverlay
          idPrefix="trail"
          lines={routeLines}
          connectors={routeConnectors}
          connectorDashArray={[...MapTokens.connectorDashArray]}
          color={isActivity ? c.activityLine : c.trailLine}
          lineWidth={MapTokens.trailLineWidth}
          colouredLines={colouredLines}
          casing
          {...arrowProps}
          endpoints={{
            points: routeEndpoints,
            radius: MapTokens.endpointRadius,
            strokeColor: c.trailEndpointStroke,
            strokeWidth: MapTokens.endpointStrokeWidth,
          }}
        />
```

The live track keeps exactly what it passes today, plus `idPrefix="route"` — no casing, no arrows, no endpoints:

```tsx
        <RouteOverlay
          idPrefix="route"
          lines={liveLines}
          connectors={liveConnectors}
          connectorDashArray={[...MapTokens.connectorDashArray]}
          color={c.recordingLine}
          lineWidth={MapTokens.recordingLineWidth}
        />
```

Keep the block comment about painter's order at the top of the file — it is still true and still load-bearing.

- [ ] **Step 4: Verify and commit**

Run: `npx tsc --noEmit` first; it is the real check that no prop was dropped.
Then: `npm run verify` — expected green, **test count unchanged at 583**.

Also confirm by grep that no `TrailOverlay` or `RouteLine` reference survives anywhere in `src` or `app`:
```bash
grep -rn 'TrailOverlay\|RouteLine' src app
```

```bash
git add src/map
git commit -m "refactor(map): collapse the port's two route lines into one overlay"
```

---

### Task 3: colour whichever route the graph is showing

**Files:**
- Modify: `src/map/MapOverlays.tsx`, `src/map/MapCanvas.tsx`

**Interfaces:** consumes `RouteSource` and `RouteDisplay.kind` from Task 1, and `RouteOverlay` from Task 2. Produces nothing new.

**This is the one task that changes what is drawn.** After it, a recording with no trail selected shows a slope-coloured live track instead of a plain one, matching the graph above it.

- [ ] **Step 1: Give `MapOverlays` one colouring value to route**

Replace the `colouredLines?: ColouredLine[]` prop with:

```ts
  colouring?: { kind: RouteSource; lines: ColouredLine[] }
```

The route overlay is coloured when the colouring describes it, and the live overlay when the colouring describes the live track:

```tsx
          colouredLines={colouring?.kind === routeKind ? colouring.lines : undefined}
```
```tsx
          colouredLines={colouring?.kind === 'live' ? colouring.lines : undefined}
```

`routeKind` already exists in this file. That single comparison is the whole of DUP-10's fix at the render end: what gets coloured is read from the same value the profile was derived from, rather than re-decided.

Update the file's top comment to say that the colouring follows the route it was derived from — the painter's-order sentence stays.

- [ ] **Step 2: Stop gating the colouring on there being a route**

In `src/map/MapCanvas.tsx`, the colouring currently only runs when a trail or activity is on screen:

```ts
  const colouredLines = useRouteColouring(route ? display : null)
```

It becomes simply:

```ts
  const colouredLines = useRouteColouring(display)
  const colouring = display && colouredLines ? { kind: display.kind, lines: colouredLines } : undefined
```

and `colouring` is passed to `MapOverlays` in place of `colouredLines`.

Removing that gate is the point: during a recording with no trail, `display` is derived from the live points, and the live track can now be coloured from it.

- [ ] **Step 3: Verify and commit**

Run: `npm run verify` — expected green, **583 tests**, unchanged.

```bash
git add src/map
git commit -m "feat(map): colour whichever route the elevation graph is showing"
```

- [ ] **Step 4: Hand over for device verification**

Report that Task 3 is ready for the controller's device pass. **Do not run `adb` yourself.** State in your report which behaviours you expect to have changed and which you expect to be untouched, so the device check has something to falsify.

---

### Task 4: close DUP-9 and DUP-10 in the review documents

**Files:**
- Modify: `docs/reviews/2026-09-10-full-review.md`, `docs/reviews/2026-10-06-open-work.md`

**Interfaces:** none — documentation only.

**Do not start this task until the controller reports the device checks passed.** The closure notes must describe what was verified, and that is not knowable before.

- [ ] **Step 1: Tick both findings**

Append a `· **Done** (<commit>): …` clause to DUP-9 and DUP-10 in the style the other closed findings use. Verify each hash with `git show --stat <hash>` before citing it — misattributed commits have been a recurring defect in these documents.

State for DUP-9 what actually changed on screen (the live track is slope-coloured when it is the route the graph is showing) and what deliberately did not (it stays plain while a trail is followed, because the display is derived from the trail then — the finding's own deferred question, still open and the owner's call).

- [ ] **Step 2: Record the device verification**

Say which checks were run and what was observed, including the frame-time measurement during a no-trail recording. Do not claim any check that was not run.

- [ ] **Step 3: Correct every count**

The Duplication row currently reads `0 / 0 / 3`. Enumerate the open DUP findings yourself and set the true value; update the row's Status cell and Summary text if either is now wrong. Note the convention line above the table: counts are *open* findings.

In `docs/reviews/2026-10-06-open-work.md`, remove the closed findings from the "outside the table" list, add "Closed below" entries, and re-derive the outside-the-table count, the "others" count, and the total by enumeration.

Check also whether the deferral note added by the previous sweep still reads correctly — it listed DUP-9 and DUP-10 as deferred for want of a device, which is no longer true.

- [ ] **Step 4: Verify and commit**

Run: `npm run verify` — green, unchanged.

```bash
git add docs/reviews
git commit -m "docs(reviews): close dup-9 and dup-10"
```
