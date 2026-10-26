---
severity:
category: bug
size:
triage: needs-triage
source: "owner, tasks.md (moved 2026-10-26)"
blocked_by: []
---
# FIELD-35: the New trail header stays light in dark theme

Owner observation. With the device in dark theme, the add-trail screen's header ("New trail") is light themed.

## Comments

> *Comment written by an AI agent.*

Reproduced 26/10 (`cmd uimode night yes`). Header #FFFFFF with a dark title over a #121212 body,
and the back arrow, coloured `c.onSurface` (light in dark theme), becomes almost invisible on the
white. It is not specific to "New trail": Debug log, Offline maps and Edit trail have the same white
header. `src/components/ScreenHeader.tsx` passes no `headerStyle`, `headerTintColor` or
`headerTitleStyle`, and no navigation `ThemeProvider` exists in `app/` or `src/`, so the native
header keeps React Navigation's default light theme. The fix belongs in `ScreenHeader` (or a
navigation theme at the root), not in `app/trail/new.tsx`. Same family as `PROP-42`. Evidence:
`.scratch/device-checks/2026-10-26/D/04-*`, `07-*`, `08-*`, `09-*`.
