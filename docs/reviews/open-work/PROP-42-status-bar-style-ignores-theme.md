---
severity: minor
category: bug
size: S
triage: needs-triage
source: "device check, 2026-10-26"
blocked_by: []
---
# PROP-42: the status bar style is fixed to light whatever the theme

`app/_layout.tsx:57` renders `<StatusBar style="light" />` once for the whole app, while the
screens follow the system scheme through `useTheme` (`src/theme/useTheme.ts:5`). White icons and
clock are therefore unreadable on every light surface. Device check of 2026-10-26, pixel-sampled
under the clock:

| Screen | Dark theme | Light theme |
|---|---|---|
| Map (light map style) | poor, pale tiles | poor |
| Trails, Activities, Settings tabs | readable (#121212) | unreadable (#FAFAFA) |
| New trail, Debug log, Offline maps, Edit trail, Save activity | unreadable (#FFFFFF header) | unreadable |

Only the coloured notification icons stay visible. The pushed screens are white in both themes
because of `FIELD-35` (`ScreenHeader` leaves the native header on the default light theme); fixing
that alone still leaves the light-theme tabs unreadable. The status bar style has to follow the
surface under it, at least the scheme. Evidence: `.scratch/device-checks/2026-10-26/D/*-top.png`,
`B/42-*`, `C/22-save-filled.png`.
