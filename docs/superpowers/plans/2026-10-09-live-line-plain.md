# Live Line Plain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The live recording line is never slope-coloured. The colouring lives on the elevation graph and on the trail/activity overlay only.

**Architecture:** `MapCanvas` derives the colouring only when the graph's view describes the route actually on screen; `MapOverlays` hands it to the route overlay alone. The live overlay goes back to a plain `recordingLine` with no casing.

**Tech Stack:** TypeScript 6, React 19, Jest 29 via jest-expo, @rnmapbox/maps behind the port at `src/map/provider/`.

**Spec:** `docs/superpowers/specs/2026-10-09-live-line-plain-design.md`

## Global Constraints

- **This is the owner's decision, not a defect fix.** The live line carries its own colour so it reads as the live one; the map/graph "disagreement" DUP-9 named is intended.
- **Keep everything else from `3a56be8`**: the merged `RouteOverlay`, the `RouteSource` discriminator, the empty-runs guard in `routeColouring` and its tests. Only the live track's colouring and casing go.
- NO JSDoc. Comments explain *why*, never what changed, and never narrate this reversal.
- Commit subjects: lowercase, conventional-commit prefix, ONE line, no body.
- Baseline, measured: **71 suites / 586 tests**. Expected after Task 1: **unchanged**. No pure function changes, so no test should need editing — if one does, stop and report.
- **Do not run `adb`.** The controller device-verifies between Task 1 and Task 2.

---

### Task 1: the colouring lands on the route overlay only

**Files:**
- Modify: `src/map/MapCanvas.tsx`, `src/map/MapOverlays.tsx`, `src/map/provider/types.ts`

**Interfaces:**
- `MapOverlays`'s `colouring?: { kind: RouteSource; lines: ColouredLine[] }` prop becomes `colouredLines?: ColouredLine[]` again. `RouteOverlayProps` is unchanged — `casing` stays on the port, the live call site simply stops passing it.

- [ ] **Step 1: Derive the colouring only where it can land**

In `src/map/MapCanvas.tsx`, replace the two lines that currently build `colouredLines` and `colouring`:

```ts
  const colouredLines = useRouteColouring(route && display?.kind === route.kind ? display : null)
```

Add a short *why* comment above it saying the colouring belongs to the route on screen and never to the live track, which keeps its own colour so it reads as the live one. Do not mention that this changed.

Pass `colouredLines={colouredLines}` to `MapOverlays` in place of `colouring={colouring}`.

Note what this expression does in each mode, and satisfy yourself it is right before moving on: trail and activity mode match and colour the route; a recording with a trail matches `'trail'` and colours the trail; a recording with no trail has `route === null`, so the argument is `null` and nothing is computed; free mode has no display at all.

- [ ] **Step 2: Hand it to the route overlay alone**

In `src/map/MapOverlays.tsx`:

- change the prop back to `colouredLines?: ColouredLine[]` in both the destructuring and the type;
- delete the `liveColouring` local;
- the route overlay takes `colouredLines={colouredLines}`;
- the live overlay takes **neither** `colouredLines` nor `casing` — delete both lines and the comment above `casing`.

Rewrite the file's top block comment so it is true again: the painter's-order sentence stays, and the colouring sentence should now say the colouring only ever reaches the route overlay, the live track keeping its own colour. Keep it to the file's existing voice and length.

Check afterwards whether the `RouteSource` import is still used in this file; if it is not, remove it. `npx tsc --noEmit` will not flag an unused type import but `expo lint` may.

- [ ] **Step 3: Correct the port's casing comment**

In `src/map/provider/types.ts`, the `casing` comment currently says the live track carries one when slope-coloured. That is about to be false. Return it to describing the route overlay as the only caller that passes it — and keep it a *why* comment (an outline lifts the line off the map), not a list of callers.

- [ ] **Step 4: Verify**

Run `npx tsc --noEmit` first — it is what catches a prop left behind in the rename.

Then: `npm run verify`
Expected: green at **71 suites / 586 tests**, unchanged. No test file should need editing.

Confirm by grep that nothing still refers to the removed shape:
```bash
grep -rn 'colouring' src app --include=*.ts --include=*.tsx
```
Expected: only `useRouteColouring` / `routeColouring` identifiers and comments; no `colouring=` prop and no `{ kind, lines }` pair.

- [ ] **Step 5: Commit**

```bash
git add src/map
git commit -m "fix(map): keep the live recording line its own colour"
```

- [ ] **Step 6: Hand over for device verification**

Report that Task 1 is ready for the controller's device pass. **Do not run `adb`.** State mode by mode what you expect on screen, so the device check has something to falsify: trail, activity, recording with a trail, recording with no trail, free.

---

### Task 2: record the decision and the device results

**Files:**
- Modify: `docs/reviews/2026-09-10-full-review.md`, `docs/reviews/2026-10-06-open-work.md`

**Interfaces:** none — documentation only.

**Do not start until the controller reports the device results.** The notes must describe what was actually seen.

- [ ] **Step 1: Correct DUP-9's closure**

DUP-9's note currently says the live track is slope-coloured when it is the route the graph is showing, and leaves open the question of colouring it while following a trail. Both are now wrong.

Rewrite that part of the note so it records, in the document's voice:
- the **duplication** half is closed — the port's two route-line components are one;
- the **behavioural** half was reversed by the owner: the live line is never slope-coloured, because it is not a route being analysed but the line showing where you are now, and it keeps its own colour so it reads as the live one;
- the colouring has two homes, the elevation graph and the trail/activity overlay;
- cite the commit from Task 1, verified with `git show --stat` before citing it.

Do **not** present the earlier behaviour as a defect that was fixed — it was a reading of DUP-9 that the owner corrected. The document must not imply the owner changed their mind about something they were never asked.

Also remove the "deferred sub-question" about colouring the live track while following a trail — it is answered.

- [ ] **Step 2: Record the device results**

Write what the controller reports, and nothing more.

- [ ] **Step 3: Close out DUP-5's colour check**

`docs/reviews/2026-09-10-full-review.md` and `docs/reviews/2026-10-06-open-work.md` both say DUP-5's light-theme colour at the 2D/3D label (`#000000` → `#1C1B1F`) has not been seen on a device. The controller is checking it. Replace that caveat with what was actually found.

- [ ] **Step 4: Give pending device checks a home**

The owner looked for DUP-5's outstanding check in `docs/reviews/2026-10-06-open-work.md` and could not find it: it was recorded inside a *closed* finding's note, where the "what is left" lists never surface it.

Add a short **Pending device checks** section to that document listing any closed finding carrying an unverified visual claim, each with one line and a pointer to its finding. If the controller's pass leaves none outstanding, say that explicitly rather than omitting the section — a reader needs to know the list is empty, not missing.

- [ ] **Step 5: Correct every count**

Enumerate the open findings yourself and fix any count this makes wrong in either document. Note the convention line above the dashboard: counts are *open* findings. Closing nothing new should leave them unchanged — verify that rather than assuming it.

- [ ] **Step 6: Verify and commit**

Run: `npm run verify` — green, 71 suites / 586 tests.

```bash
git add docs/reviews
git commit -m "docs(reviews): record that the live line stays its own colour"
```
