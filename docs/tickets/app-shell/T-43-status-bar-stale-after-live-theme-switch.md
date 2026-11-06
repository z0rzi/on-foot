---
severity: minor
category: bug
size: S
triage: needs-triage
origin: agent
filed: 2026-11-02
from: "device check, 2026-11-02"
blocked_by: []
---
# T-43: the status bar keeps the launch scheme after a live theme switch

Residue of PROP-42, found by its device check on the release build of `overnight/2026-11-01`.
On a cold start the status bar is right in both schemes: dark icons over the light Trails tab, light
icons over the dark one. Switching the system scheme while the app is open (`cmd uimode night
yes|no`) leaves the icons as they were at launch, in both directions: white on #FAFAFA after
dark → light, dark on #121212 after light → dark. Backgrounding and resuming does not fix it; only
a cold start does.

The app does see the switch: in the same run the native headers (`ThemeProvider` in
`app/_layout.tsx`, fed by `useColorScheme`) turned light at once. `expo-status-bar` 57 also reads
`useColorScheme` and recomputes `barStyle` on each render
(`node_modules/expo-status-bar/src/NativeStatusBarWrapper.tsx`), so the `style="auto"` prop
should resolve to the new value. Unconfirmed hypothesis: React Native's `StatusBar` only pushes a
changed `barStyle` to the native side, and on a uiMode configuration change Android (or the
edge-to-edge setup) re-applies the window's light-status-bar flag from the theme after React Native
has written it. Read the Android side of React Native's `StatusBarModule` and the edge-to-edge
handling in this SDK before choosing a fix.

Seen on a real phone (a dusk auto-switch does this while the app is open). Evidence:
`.scratch/device-checks/2026-11-02/status-bar-*.png`.
