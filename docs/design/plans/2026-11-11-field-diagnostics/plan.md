# Field diagnostics

Spec: [[2026-11-11-field-diagnostics-design]]. Four independent slices, each adding debug-log
entries for one ticket. None closes its ticket: the entries are the first step each ticket asks for.

| # | Item | Delivers |
| --- | --- | --- |
| 01 | A route shown logs how long its load and its derivation took | `route loaded` and `route derived`, T-4 handed back to the owner |
| 02 | A launch logs its camera choice, and every fit logs who asked | `launch camera`, `fit requested`, `fit fired` |
| 03 | A delivery of fixes that vanishes before the gate is logged | `delivery fault`, `delivery waiting` |
| 04 | A recording logs whether the phone's compass is still turning | The port's `watchHeading`, `heading watch`, `heading sample`, `heading stalled`, puck mounts |

## What the build needs beyond the spec

- **Every new entry is listed in `docs/architecture/debug-log.md`** under its area, in the item
  that adds it. All four items edit that file; they are built one after the other on the
  integration branch for that reason, not because they depend on each other.
- **04 reads the Expo docs first** (`AGENTS.md`): the heading watch of the `expo-location` version
  pinned in `package.json`, its Android behaviour and the shape of its payload. If the watch needs
  a permission or a manifest entry the app does not already have, stop and report.
- **04's seam change is a new port member, not a new seam**: `src/location/` is already registered
  in `src/architecture/seams.ts`. The port's types name no Expo type.
- **Device checks are owed, not done**: the phone was locked when this was planned. Each item
  lists the entry a device check must see; they go to `docs/tickets/device-checks.md` if the build
  lands before a check can run.
- **`draped-route-overlay` is unmerged and rewrites `src/map/providers/mapbox/adapter.tsx`.** No
  item here touches that file: the puck's mount entries are logged on the map side of the port.
