# Hiking UX: the map is home, one card leads everywhere else — Design

**Status:** Built, tickets T-50–T-65, then T-67–T-68, then T-69–T-72, then T-74–T-77, then
T-79–T-82, then T-90–T-94, all closed; follow-ups in the worklist with `from` this spec, device
claims still owed in `docs/tickets/device-checks.md` (owner's grilling 2026-11-06; revised the same
day after the pre-implementation challenge; revised 2026-11-07 after the owner's first look at the
build on the device, D51–D60; sizes revised the same day after the owner's walk with the build, D61;
the sheet became a floating card the same day after the owner's second look, D62–D71; pip, margins
and translucency revised after the owner's first look at the card, D72–D74; tickets T-69–T-73;
status bar, opacity, graph gap, y range, fade and in-plot labels after the owner's second look at
the card, D75–D80; recording card, metrics and track order after the owner's hike of 2026-11-08,
D81–D83; the ahead line revised by [[2026-11-09-walking-time-ahead-design]], D84–D88; its review
rulings, D89–D93; the card and the graph puck after the device check, D94–D96; the card after its
own check, D97–D101; the route's markers above the track after the draped overlay's device check, D102)
**Ticket:** `T-14` (app shell). Pulls in `T-23` (you-are-here dot on the graph, while recording) and
answers the display half of `T-38` (pace at recording start).
**Date:** 2026-11-06, revised 2026-11-09, 2026-11-11
**Evidence:** code audit and device walk of 2026-11-06, screenshots in
`.scratch/device-checks/2026-11-06-ux-rethink/`; the owner's device look at the build of 2026-11-07,
screenshots in `.scratch/device-checks/2026-11-07-hiking-ux-feedback/` (both gitignored, cited by
file name below).

Terms are the glossary's: **Follow**, **Free camera**, **Layer**, **Offline map**, **Segment**,
**Point**, **Card** (the graph card and the nav card), **Pill**, **Nav row**. "Sheet" names only the
library component in code (`MapInfoSheet`, gorhom's bottom sheet). New user-facing words are in the
vocabulary table.

## 1. Why this structure

Today the app is organised around its **data objects**: a bottom tab bar with Map, Trails,
Activities and Settings, and a Map tab that switches between modes (free, trail, activity,
recording). Recording, the job the app exists for, is one mode of one tab: the tab bar stays on
screen the whole hike, the live figures sit in a bottom sheet, and the top of the screen is empty
while recording (`14-recording-2min-collapsed.png`). The new app is organised around **the hike**:
the map is the only home screen and is never covered by navigation. What you need while walking is
always visible: the figures in a pill at the top, the elevation graph on a card at the bottom, the
record button under the thumb. Everything you need before or after a hike is one pull of the card
away, and opens as a full screen over the map.

## 2. Principles

1. **The map is always visible.** The owner's first job is "am I on track" (D2, D5). Nothing
   permanent covers the map except the pill, the card (the graph on it) and the map controls; the
   map shows through the card's margins.
2. **What you watch goes at the top, what you touch goes at the bottom.** The figures need no
   thumb, so they go in the top pill. Actions stay in the thumb zone (ticket T-14, D11, D24).
3. **One top slot says where you stand**, with one sentence per state. It replaces the mode chips
   and the live sheet's status title, which said "Paused" twice (F4, D12).
4. **One place per thing.** One action menu per trail or activity, the same wherever it appears
   (F13, F25, D10, D31). One meaning per word: Follow is the camera, Along is the trail (F6, D28).
   One way back to the map (D45).
5. **Every write says what happened and shows its result** (F15, F16, D17, D32).
6. **The recording is never invisible.** Wherever you are in the app, you can see that a
   recording is running (F1, D21).

## 3. Navigation

There is no tab bar. The app is one stack:

| Route | Screen | Reached from |
|---|---|---|
| `/` | Map (home) | launch; every return to the map |
| `/trails` | Trails | nav row "Trails" |
| `/activities` | Activities | nav row "Activities" |
| `/settings` | Settings | nav row "Settings" |
| `/settings/offline` | Offline maps | Settings |
| `/settings/log` | Debug log | Settings |
| `/trail/new` | New trail | "Add a GPX file" in Trails; share / Open with (unchanged route, D3) |
| `/trail/[id]/edit` | Edit trail | trail ⋮ "Edit trail" |
| `/activity/save` | Save activity | paused "Stop" |

- **Landing page:** the Map, always. There is only one role (D1).
- **The nav row** sits at the bottom of the pulled-up graph card, in every map state, and is the
  whole card (the nav card), always on screen, when nothing is shown and idle (D69): three equal
  buttons with icon and label: **Trails**, **Activities**, **Settings**. No counts or badges.
- **Pushed screens** share one header (title, back arrow, and the recording banner while
  recording, §4.6). Back and Android back return one level.
- **Every "return to the map"** (a list tap, the banner, save, discard, import, the offline-maps
  group tap) goes through one helper that pops back to the existing Map, or replaces the current
  screen with the Map when there is none underneath (a cold-start Open with). It never mounts a
  second Map (D45).
- **Phone layout** is the only layout. The app is locked to portrait on one Android phone.

## 4. Screens

### 4.1 Map (`/`)

Purpose: the hike. See where you are against the trail, read your figures, start, pause and stop.

Layers, from back to front:

1. **Full-screen map**, under the status bar. The status icons sit straight on the map, with no
   scrim, in both themes (D57), and follow the layer's tiles rather than the app's theme: dark icons
   over a light layer (Default, Outdoors), light ones over a dark one (Satellite). The tone is a
   semantic field the provider declares on each layer (`StyleDescriptor.tone`); the Map sets it
   only while it is the focused screen, and pushed screens keep the theme's style (D75).
2. **Top pill** (§4.2), centred, under the status bar.
3. **Map controls**, right-hand column, all kept and all on the map (D15): Reset north (only when
   rotated), 2D/3D, Layers, Frame the whole route (only when something is shown), Center on your
   location. Behaviour is unchanged.
4. **Record button**, bottom-left, level with the bottom of the control column (§4.3).
5. **Map card** (§4.5), always present, floating over the map with a 16 dp margin from the sides
   and from the screen's bottom edge, the system's gesture area inside the bottom margin (D62, D66,
   D74). Something shown, it is the **graph card**: collapsed, the pip
   and the elevation graph (§4.4); pulled up, the same card grown upward. Nothing shown and idle,
   it is the **nav card**: the nav row alone, which does not move (D69).

The map controls and the record button sit **above** the card, never level with it (D53, D71):
12 dp above the card's top edge, riding it as the card moves. They hide while the card is pulled up
past half the screen, so they never end up under the pill; they come back when it is lowered (D43).
The graph stays visible at every height, as the card's header; the open-height cap counts it and
the card's margins, so it never reaches the pill (D60, D68).

**Camera padding.** Framing a trail or activity, and following, keep the subject clear of the
overlays: top padding = the pill's bottom edge (the status bar's bottom when there is no pill) plus
a margin; bottom padding = the top edge of the resting card (the collapsed graph card, graph
included; the nav card when nothing is shown), its bottom margin included, plus a margin (D44,
D71). The padding only keeps the subject out from under the overlays: a framed trail fills the band
between them, so a 2 km trail is framed at walking scale, not at city scale
(`22-activity-frame-route.png` and `23-after-trail-save.png` show the opposite, B2). Today's fixed
`top: 100` puts a framed trail's top under the pill.

Mock, recording along a trail, graph card collapsed:

```
┌──────────────────────────────────────┐
│ 13:36                           88%  │  status bar, straight on the map
│ ╭──────────────────────────────────╮ │
│ │ 1:12:05  6.4 km   12:40  412 m   │ │  pill
│ │  time   distance  /km    gain    │ │
│ ╰──────────────────────────────────╯ │
│                                      │
│              (map: trail,            │
│               live track,            │
│               puck)                  │
│                                  (N) │  only when rotated
│                                 (3D) │
│                                 (≋)  │  layers
│                                 (⛶)  │  frame the whole route
│ ( ‖ )                           (◎)  │  record (hold to pause) · center
│                                      │  12 dp
│ ╭──────────────────────────────────╮ │  graph card, collapsed, translucent: 16 dp side
│ │               ▬▬▬                │ │  margins; pip row 20 dp (tap to open, 44 dp target)
│ │ 300 m ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈ │ │
│ │ 250 m ┈┈╱‾‾╲┈┈┈┈┈●┈┈┈╱‾‾╲┈┈┈┈┈┈ │ │  graph with its y-axis, ● = you (recording only)
│ │ 200 m ╱┈┈┈┈╲_____╱┈┈┈┈┈┈╲_____┈ │ │
│ ╰──────────────────────────────────╯ │  16 dp from the screen's bottom edge (on the system
│               ════                   │  inset if taller); gesture bar in the margin
└──────────────────────────────────────┘
```

Nothing shown and idle, the card at the same place is the nav card: Trails · Activities · Settings,
no pip, translucent like the collapsed graph card, the record button and the controls 12 dp above
it.

States of the Map:

| State | Pill | Record button | Graph | Card, resting | Card details (pulled up) |
|---|---|---|---|---|---|
| Nothing shown, idle | hidden | Start | none | nav card: the nav row, no pip; does not open (D69) | none |
| Trail shown, idle | trail sentence, ✕ | Start | trail profile, no puck (D42) | graph card, collapsed: pip, graph | trail details |
| Activity shown | activity sentence, ✕ | Start (see below) | activity profile, no puck | as trail | activity details |
| Recording | figures | Pause (hold) | trail profile with puck if along a trail, else live profile with puck at its end (D23) | as trail | recording details |
| Paused | figures + "Paused" | Resume, Stop | as recording | as trail | recording details |
| Recording, location problem | figures + warning line | Pause (hold) | as recording | as trail | recording details |

When the state changes from one of nothing shown, trail, activity and recording (paused included)
to another, the card goes to the new state's resting position (§4.5, D59).

- **Start while an activity is shown** ends the activity view, then starts recording along no
  trail. Today the record button is hidden in activity view with no explanation (F10). A wrong
  start is undone by Discard. D37, D49.
- **Android back** on the Map collapses the card if it is pulled up, and otherwise leaves the
  app as today (D34). The handler is active only while the Map is the focused screen, since the Map
  stays mounted under pushed screens. Clearing what is shown stays the pill's ✕.
- **Loading:** the splash covers the map until the launch camera is decided (unchanged).
- **Error:** a render throw falls to the existing ErrorBoundary ("Something went wrong" /
  "Try again").

### 4.2 Top pill

One slot with one sentence per state (D12). It replaces `MapModeChip` (all three uses) and the
status title at the top of `RecordingInfoSheet`.

**Look** (D35): a thick pill, white and about 70% opaque in light mode (D76), dark surface at the same
opacity in dark mode (`pillSurface`), rounded, with a soft shadow drawn outside the shape only, the
one shadow token the map card shares (§4.5, D72). Horizontal margins of 12 dp. It sits at
`insets.top + 8`. Figures are large (about 21 sp, tabular digits, `onSurface`, D61) with small labels
under them (about 12 sp, `onSurfaceVariant`). At a large system font scale the figures shrink to
fit their column (down to about 16 sp) rather than truncate.

**Recording**: four figures, equal columns (D11):

| Figure | Value | Label |
|---|---|---|
| Time | moving time, `m:ss` / `h:mm:ss` (unchanged formatter and stopwatch) | `time` |
| Distance | `x m` / `x.x km` | `distance` |
| Pace | current pace (rules below), `m:ss` | `/km` |
| Gain | elevation gain so far | `gain` |

**Pace rules** (D6, refined D41):

- **The window is the most recent 1 000 m of track.** Walk back from the last point, summing
  distance and time between consecutive points of the same segment. A segment gap (pause and
  resume, or a relaunch) contributes neither distance nor time; the walk-back carries on into the
  earlier segment. The pair of points that crosses the 1 000 m mark is interpolated, so the window
  is exactly 1 000 m.
- **Standing still does not count.** A step between two points slower than 0.5 km/h contributes
  neither its time nor its distance. A lunch break without pressing Pause does not drag the pace
  for the next km.
- **Under 1 000 m walked in total**, the window is everything walked so far (same rules). Under
  200 m, the value is `—`. This removes the absurd pace at the start (T-38).
- **Tap the pace figure** to switch to speed over the same window, label `km/h`, and back (D29,
  D38). The choice is persisted as today (`paceSpeedMode`). The label is the visible cue;
  `accessibilityLabel` "Switch between pace and speed".
- Elevation loss is not shown live. The pill holds four figures, and loss stays in the saved
  activity (F19).

**Paused**: the pill takes a light tint of the recording colour, and a small line "⏸ Paused" sits
above the figures row. The figures keep their full contrast, frozen at the moment of pausing; pace
or speed no longer drifts (today the speed tile stays stale but looks live, `17-paused.png`). The
Paused line takes no width from the figures.

**Location problem**, while recording only (D26). Capture is off while paused, so nothing is
reported then. A second line under the figures, in the warning colour, with the existing texts of
`streamHealth.ts`:

- location off: "Location is off · Recording continues when it's back on."
- capture stopped for lack of permission: "Not recording location · Allow location access for On
  Foot in Settings." then a text button **Retry**.
- capture stopped for another reason: "Not recording location" then **Retry**.

Retry's `accessibilityLabel` is "Retry location capture". When it gives nothing back, the line
stays; when capture resumes, the line disappears. That disappearance is the feedback.

**Trail shown, idle**: one line, "{trail name} · {12.0 km} · {956 m} gain", then ✕
(`accessibilityLabel` "Stop showing trail"). The name is truncated first; the card shows it whole
(§4.5). Tapping ✕ clears the selection: the trail leaves the map, the graph card gives way to the
nav card. No toast: the map change is the feedback.

**Activity shown**: "{activity name} · {Oct 3, 2026}", then ✕ ("Stop showing activity").

**Nothing shown, idle**: no pill.

The ✕ targets are at least 44 dp (today about 18 dp).

### 4.3 Record button

Floating bottom-left, **48 dp** round with a 24 dp icon (today 36 dp), same colours as today (D16,
D24, D61), 12 dp above the card (§4.1).

- **Idle**: play icon, `accessibilityLabel` "Start recording". Tap starts. Feedback: the button
  becomes Pause and the pill switches to figures. Refusals keep today's alerts ("Location
  permission needed", "Location is off", "Could not start recording").
- **Recording**: pause icon, `accessibilityLabel` "Pause recording (press and hold)". No caption
  under the button (D56). The 1 s hold ring stays. A short tap shows the toast "Hold to pause" as
  today: that toast is how the hold is learnt.
- **Paused**: two 48 dp buttons side by side: **Resume** (play) and **Stop** (stop, "Stop and save
  recording"). Stop opens Save activity, as today.

### 4.4 Elevation graph

The graph has one placement: it is the graph card's header, under the pip (D62, D63). It is visible
whenever the state has a profile, so it is on screen for the whole walk, at every height of the
card (D60): the open-height cap counts it, so its top never goes above 80% of the screen and never
reaches the pill. The map controls and the record button sit above the card (D53) and hide past half
height (D43). The graph is part of the card's draggable content, so a vertical drag on it moves the
card as the pip does.

**Look** (D64): one style, the one built for a surface. Each slope band filled with its colour fading
down its area, as master's floating graph did: full at the band's top edge, 45% at 60% of the way
down, nothing at the floor (D79); the flat band in a theme-aware grey (`slopeFlatOnPanel`, light and dark) that reads
on the card, where master's sheet colour vanished white on white; the line in `onSurface`, width and
opacity per band from `bandStyle.ts`. The plot spans the profile's own range, as on master: its lowest point on the plot's bottom edge,
its highest 6 dp under the top (D78). A **y-axis** (D55): up to three elevation labels,
the round numbers inside that range at the finest round step that gives no more than three (e.g.
"200 m", "250 m", "300 m"; "1250 m", "1500 m", "1750 m" for a 1150–1998 m profile), never a label
past the plotted range, about 11 sp in `onSurfaceVariant`, with a faint horizontal gridline at each. The labels
are drawn in the plot at its left edge, 4 dp in, each just above its gridline (just under it when the
gridline is too near the top for the digits to fit). Two labels never overlap: placed from the
lowest up, a label whose digits would come within 2 dp of the label below it is not drawn, nor is
its gridline, so the axis shows the labels that fit. Gridlines sit more than 14 dp apart, so at the
usual text sizes two labels each above their gridline always fit, and the label dropped is a top one
sent under its gridline: on a 146–202 m profile "200 m" would land on "180 m", and the axis reads
"180 m", "160 m" (T-93). The labels sit
behind the bands, the line and the puck, which may hide them in places, plain text with no rim; no gutter, the plot takes the card's whole content width,
16 dp in from each side (D80). A profile flatter than 10 m is drawn over 10 m around its middle, so
noise reads flat; that range is wider than the profile, so a label may then lie below its lowest point
or above its highest (a 1002–1006 m profile is drawn over 999–1009 m, labelled "1000 m" and "1005 m"). Under the graph, 12 dp of the card: the
plot never rests on the card's bottom edge, and the open card's details start as far below it as
they are from each other (D77). No x-axis: the scrub tooltip gives the distance. Master's painted-on-map style (gradient fill, light
grey flat band, dark line on a white halo) is gone with the placement setting; `slopeFlat` stays
the map route's flat colour (`routeColouring.ts`).

What it draws (D13, D23, D42):

- **Trail shown, idle**: the trail's profile, slope-coloured as today. No puck: outside a
  recording no position reaches the app (the map's puck is drawn by the provider), and a single
  position cannot tell which branch of an out-and-back you are on.
- **Recording along a trail**: the trail's profile, with no difference between walked and
  unwalked parts, and a **puck** (a dot in the puck's colour, with a white ring) at your position
  along the trail, its centre always exactly on the line: drawn over the plot rather than inside
  it, so at an edge it reaches into the card's margin and stays whole, never pushed off the line
  (D96). It is drawn over the scrub cursor's line too, which passes under it; the scrub tooltip
  covers it. The position comes from the T-23 algorithm (R ≈ 20–30 m, closest-to-`s`
  tiebreak), computed as a fold over the recording's points: replayed from the start when the Map
  becomes focused and active, then advanced one step per new batch of points while it stays so. It
  never runs while the Map is hidden or the app is in the background. When the last point matches
  no part of the trail, there is no puck: you are off the trail, which the map shows. Points
  arrive in batches, so the graph's puck can trail the map's by up to the batch interval
  (about 15 s).
- **Recording along no trail**: the live profile, with the puck at its right end.
- **Activity shown**: the activity's profile, no puck.
- Fewer than 2 profile samples: no graph; the collapsed card is the pip row only, laid out 44 dp
  tall (§4.5), and the overlays sit above it.

**Gestures**: a horizontal drag on the graph scrubs (tooltip "{ele} · {distance} · ±{grade}%" plus
the marker on the map, unchanged). The tooltip floats over the top of the plot while a scrub runs and
reserves no row of its own: the graph's height is the plot's (D73). A vertical drag on the graph
moves the card, so an upward drag opens it (D52). The graph is part of the card's grab area; the
pip's touch target reaches down over its top (§4.5), where a tap toggles the card while a horizontal
drag still scrubs and a vertical one still moves the card. A touch that lands in that band shows no
scrub cursor, tooltip or map marker until it turns into a scrub, so a tap there only toggles; a touch
anywhere else on the plot shows the scrub as it lands.

### 4.5 Map card

Always present (D18, D62). One component in every state (`MapInfoSheet`, gorhom's bottom sheet in
`detached` mode), so the nav row is never more than one pull away. The card floats over the map:
16 dp from each side and 16 dp from the screen's bottom edge, the overlay padding, so its edges line
up with the pill and the controls. The system's gesture area lies inside the bottom margin; when the
system inset is taller than the margin (three-button navigation), the card sits on top of it
instead: bottom = max(16 dp, `insets.bottom`) (D74). A pan that starts in the margin under the card
moves the map. A swipe up that starts on the card's lowest few dp may go Home (the system's gesture
zone); the pip and the graph, where drags start, are well above it. Its four corners are rounded at
16 dp. It carries the pill's shadow, drawn outside the shape only (CSS `boxShadow`): one token, in
the theme, shared by the pill and the card; the control buttons keep their own (D66, D72).

**Surface** (D72): collapsed, the card is **translucent**, the pill's surface (`pillSurface`, white
or dark at 70%, D76); it reaches the opaque `surface` colour as it is pulled open, interpolated on the
card's live index, the value the details' reveal reads. So the graph reads over a faint map while
walking, and the details' text is on an opaque surface. The map shows through the margins around
the card, which is the floating effect wanted; there is never a second window (D62).

**Nothing shown, idle**: the card is the **nav card**: the nav row (below) and nothing else, with
the same margins, corners and shadow, and the collapsed card's translucent surface (it never opens).
It has no pip and neither collapses nor opens: no drag, no
tap-to-toggle (D69). The record button and the map controls sit above it.

**Collapsed**, in every other state: the **graph card**: the pip row, then the graph when the state
has one (§4.4). The pip row is laid out 20 dp tall: 8 dp, the 4 dp pip, 8 dp, just room for the pip
above the graph; its touch target stays at least 44 dp tall by reaching down over the graph's top
(D73). The collapsed graph card is the 20 dp pip row, the plot and the 12 dp gap under it (about 94 dp, D77); nothing of the details shows
under it. With no graph (fewer than 2 profile samples) nothing lies under the pip row but the details,
so its target cannot borrow that space: the row is laid out 44 dp tall with its pip 8 dp inside the
top edge, and its target reaches no further, so the collapsed card is 44 dp and a tap on the details
(the title row's ⋮) never toggles the card. **Tapping the pip opens the card**, and tapping it when open collapses it
(`accessibilityLabel` "Show more" / "Show less", with an accessibility action, since a screen
reader cannot drag) (D67).

**Open or collapsed** is read from the card's live position, never from the end of a drag or an
animation: every way of reaching the open position counts as open, a drag that over-pulls past it
included. While open, the nav row takes taps, the pip says "Show less" and a tap on it collapses
the card, and Android back collapses it (B1, `09-idle-open-by-drag-desynced.png`,
`10-settings-tap-ignored.png`, `24-trail-open-by-drag.png` against `25-trail-open-partial-drag.png`).

**Pulled up**: the same card grows upward and its surface turns opaque with the pull; it keeps its
side and bottom margins and never snaps to full width (D68, D72). One fixed height while open. The details' height is measured as they lay out, and
the open position is set from that measurement only while the card is collapsed. A height change
while open (a download line appearing, the Along ✕) never moves the card on its own; it is taken up
on the next opening. The card's top is capped at 80% of the screen, the graph and the margins
counted (D60, D68); details beyond that scroll (D22, revised D43).

**Resting position per state** (D59). When the state changes from one of nothing shown, trail,
activity and recording (paused is recording) to another, the card goes to the new state's resting
position: the graph card collapsed, or the nav card when nothing is shown and idle. So saving an
activity lands on the activity with the card collapsed, not at the recording's open height
(`18-after-save.png`, `21-activity-open.png`). Within a state, an open card never moves on its own
(D43). A different trail or activity in the same state is shown only from a pushed screen, reached
through the nav row, which collapsed the card.

Content when pulled up, top to bottom:

1. Pip and graph (as collapsed).
2. The **details** for the state (below), scrollable.
3. The **nav row**, pinned to the bottom of the open card so it stays visible however the details
   scroll: Trails · Activities · Settings, three equal buttons with icon above label, at least
   56 dp tall. The icons are 25 dp, the size master's bottom tab bar gave them (React Navigation's
   default tab bar on a phone, D61). Tapping one collapses the card and pushes the screen. It fades
   out as the card collapses and is never visible when collapsed: while something is shown the nav
   row lives only inside the open card, there is no nav card under the graph card (D70). The nav
   card of nothing shown, idle, is this same row, always visible. The row has no surface of its own:
   the details end at its top edge at every height of the card, so the card's surface shows through
   the row as it does everywhere else, with no band where the row sits mid-pull.

The map controls are not in the card (D15, D18).

**Details per state:**

- **Nothing shown, idle**: none; the card is the nav card (D69).
- **Trail shown, idle**:
  - Title row: name, in full, wrapping over as many lines as it needs (D61), offline badge ("⬇ 42%" / "✓ Offline" / "⚠ Failed"), ⋮ (`accessibilityLabel`
    "Trail actions", 44 dp target). The badge and ⋮ are centred against the name's lines.
  - While downloading: progress bar and "Downloading {layers} · {pct}%".
  - Otherwise: difficulty badge.
  - Metrics: Distance, Elevation gain, Elevation loss. The summary line that repeated distance
    and gain is removed (it duplicates the metrics and the pill).
  - Description, if any.
- **Activity shown**:
  - Title row: name, in full and wrapping as the trail's (D61), ⋮ (`accessibilityLabel` "Activity
    actions").
  - Effort badge and date.
  - Metrics, three to a row (D82): Distance, Duration, Average pace (moved here from the live view,
    D6); then Elevation gain, Elevation loss.
  - Comments, if any.
  - Outlined button "View linked trail: {name}" (unchanged).
- **Recording / paused** (D25, revised D81, D95 and D101):
  - **Along row**, when the recording is along a trail: "Along {trail name}", in full and wrapping
    (D61), with the trail's **summary row** tight under it, as the Trails list shows it (D95): on
    one line, the difficulty badge then "· 2.0 km · 56 m gain" (`formatTrailSummary`), in the
    secondary text (D97). Beside the two, centred on them, ✕ (`accessibilityLabel` "Stop recording
    along this trail", D101). Tapping ✕ ends it: the trail leaves the map and will not be linked
    when saving. Feedback: the toast "Recording without a trail".
  - **Ahead lines** (D81, revised D84–D87, D89–D95, D99, D100), under the summary row after a gap, in the
    primary text a step larger than the summary (D95), one fact
    per line behind an icon: "Trail end in 3 h 10 (12.4 km)" ("At the trail end" at the end, D91, D100), then "Next climb in 12 min (1.2 km) · 340 m
    to climb" (D94, D99), "Climbing · 10 min to the top (230 m up)" (D99) or "No climb left"; off the trail, the one line
    "Not on the trail". The climb rule, the walking time and the personal factor are specified in
    [[2026-11-09-walking-time-ahead-design]]. They move with the puck, so up to about 15 s behind.
    "Trail end" is the trail's own end: the lines assume the walk follows the trail's direction. A trail with no elevation profile
    has no ahead lines.
  - Then the trail's description, if any, set apart: behind a thin divider, in the secondary text
    at 13 sp, so it reads as the trail's reference, apart from the live lines (D98). No metrics
    grid on this card: the summary row carries the trail's distance and gain, and its total loss
    does not help mid-hike (D95).
  - The location problem line is **not** repeated here; it is in the pill. The figures are in the
    pill.

**Trail actions ⋮** (one menu, the same in the card and in the Trails list, D10, D31), in order:

1. "Navigate to start" (unchanged; failure toast "No map app found").
2. Offline map items by state, unchanged: "Download offline map" / "Edit offline map", "Remove
   offline map" / "Retry download" / "Cancel download". Starting a download shows its progress in
   the badge, no toast. When every pack of the trail's download has settled: one toast per trail,
   "Offline map ready" or "Offline map failed", wherever the user is in the app (D40, revised).
   Remove → toast "Offline map removed" (unchanged).
3. "Edit trail" → Edit trail screen.
4. "Delete trail" (red) → alert "Delete trail" / "Delete "{name}" and its offline map? This
   cannot be undone." with Cancel / Delete. Success → toast "Trail deleted"; if it was shown, the
   map clears it. If it was the recording's trail, the recording carries on along no trail and the
   toast is "Trail deleted · Recording without a trail" (D39, revised).

**Activity actions ⋮** (card and Activities list):

1. "Delete activity" (red) → alert as today; success → toast "Activity deleted", and if shown, the
   map clears it. Failure → toast "Could not delete the activity" (today silent, F17).
2. Slots, not designed here: "Edit activity" (T-15), "Export GPX" (T-11).

The ⋮ menu opens upward when there is room above its button, downward otherwise, so it is whole on
screen from a list's first row as from the card (today it always opens upward, `ActionsMenu.tsx`).

### 4.6 Recording banner

Part of the shared header of every pushed screen while a recording runs (D21), except Save
activity, which is the end of that recording. A full-width bar under the title row, in the
recording colour, text in `onRecording`:

```
● Recording · 1:12:05                 Back to map ›
```

or "⏸ Paused · 1:12:05" when paused. The time ticks. Tapping anywhere on the bar returns to the
Map through the shared helper (§3). `accessibilityLabel` "Recording in progress, back to the map".
It replaces nothing; today no screen outside the Map shows a recording (F1,
`13-trails-tab-while-recording.png`). Loading states of pushed screens show the header too.

### 4.7 Selecting a trail while recording

Every path that shows a trail on the Map (a Trails list tap, a new trail after import, the offline
maps group tap) follows one rule while a recording runs (D9, extended D46):

- recording along no trail → the recording becomes along this trail, toast "Along {name}";
- recording along another trail → alert "Record along {new} instead of {current}?" with Cancel /
  Switch. Switch → along the new trail, the Map frames it, toast "Along {new}". Cancel → nothing
  changes; after an import, Cancel returns to the Map with the toast "Trail added", the new trail
  saved but not shown;
- the same trail → shown and framed, nothing else.

After an import the write and the Along change share one toast: "Trail added · Along {name}".

### 4.8 Trails (`/trails`)

Purpose: the list of trails, add one, open one on the map.

- Shared header "Trails" with back. Recording banner if recording.
- List of cards: thumb icon, name (up to 2 lines, today truncated to 1 line), difficulty badge,
  "{12.0 km} · {956 m} gain", ⋮ (Trail actions, §4.5). The inline pencil and trash are removed
  (D31).
- Tap a card → back to the Map with the trail shown and framed (§4.7 while recording).
- Footer button "Add a GPX file" (unchanged).
- Empty: "No trails yet. Add a GPX file, or share one to On Foot from another app."

### 4.9 New trail (`/trail/new`) and Edit trail (`/trail/[id]/edit`)

Unchanged forms. Changes:

- **After "I'm done"** on New trail: back to the Map with the new trail shown and framed, toast
  "Trail added" (D32), for every entry: the Trails list, a share, an Open with, a cold start
  (§4.7 while recording).
- **After "Save changes"** on Edit trail: back one level, toast "Trail saved".
- Labels "Elevation Gain" / "Elevation Loss" become "Elevation gain" / "Elevation loss" (§5).

### 4.10 Activities (`/activities`)

- Shared header "Activities" with back. Recording banner if recording.
- Cards as today, with ⋮ (Activity actions) instead of the trash icon.
- Tap a card → back to the Map with the activity shown. While recording: refused with the toast
  "Finish the recording to open an activity" (unchanged).
- Empty: "No activities yet. Start a recording from the map."

### 4.11 Save activity (`/activity/save`)

Unchanged form, no recording banner, plus:

- **After "Save activity"**: back to the Map with the new activity shown, toast "Activity saved"
  (D17).
- **After "Discard"** (confirmed): back to the Map, toast "Recording discarded".
- The disabled Save button gets a hint under it while disabled: "Name and effort are needed."
- "Elevation Gain" → "Elevation gain". The default title is T-30's, not designed here.

### 4.12 Settings (`/settings`)

- Shared header "Settings" with back. Recording banner if recording.
- Rows "Offline maps ›", "Debug log ›" (unchanged).
- "Elevation smoothing" chips (unchanged). No "Elevation graph" chips: the graph has one placement
  (D63).

### 4.13 Offline maps (`/settings/offline`)

The storage manager (D33). Unchanged, plus: tapping a trail's group header returns to the Map with
that trail shown (§4.7 while recording). Downloading stays in Trail actions. Remove per layer and
its toast "Layer removed" are unchanged.

### 4.14 Debug log (`/settings/log`)

Unchanged (D3), apart from the shared header. The filter chips' unreadable on/off state is left to
a ticket (§10).

## 5. Vocabulary

| Today | Proposed | Why |
|---|---|---|
| "Following · {trail}" (live sheet), "Stop following trail" | "Along {trail}", "Stop recording along this trail" | "Following" also names the camera's **Follow**; the glossary keeps Follow for the camera (F6, D28). |
| "Viewing trail · {name}" chip | "{name} · {dist} · {gain} gain" pill | The pill says where you stand; "Viewing" adds nothing. |
| "Viewing activity · {name}" chip | "{name} · {date}" pill | Same. |
| "Exit trail view" / "Exit activity view" | "Stop showing trail" / "Stop showing activity" | "View" names no concept the user knows. |
| "Paused" chip + "⏸ Paused" sheet title | "⏸ Paused" in the pill only | Said once (F4). |
| "● Recording" sheet title | the pill's figures; "● Recording · h:mm:ss" banner on other screens | On the map, the figures are the sign of recording. |
| "Pace (min/km)" / "Speed (km/h)" tile, whole-recording average | pill figure labelled `/km` or `km/h`, current pace (§4.2) | D6, D41. |
| "Duration" (live) | "time" (pill label) | Short label in the pill. "Duration" stays on saved activities. |
| "Elev. Gain" / "Elevation Gain" / "Elev. Loss" | "Elevation gain", "Elevation loss"; pill label `gain` | One spelling (F18). |
| "Map Layers" | "Map layers" | Sentence case, as the other titles. |
| "Delete Trail" / "Delete Activity" alert titles | "Delete trail" / "Delete activity" | Sentence case. |
| Map / Trails / Activities / Settings tabs | Trails / Activities / Settings in the card's nav row | The map is home, not a tab. |
| "Elevation graph: Floating / In sheet" | removed | One placement: the graph is the card's header (D63). |
| bottom sheet (the live, trail and activity sheets) | **card** (graph card, nav card), **pill**, **nav row** | Glossary words for the floating panel and its parts; "sheet" stays in code only (`MapInfoSheet`). |
| "Frame the whole route" | unchanged | Not raised; the control column is unchanged (D15). |
| Effort "Easy / Moderate / Hard / Max" vs difficulty "Easy / Medium / Hard" | unchanged | Two scales for two concepts (how hard the trail is, how hard you went). |

## 6. Data and routes

**Routes.** The `app/(tabs)/` group is removed: `index.tsx` → `app/index.tsx`, `trails.tsx` →
`app/trails.tsx`, `activities.tsx` → `app/activities.tsx`, `settings.tsx` →
`app/settings/index.tsx`. `app/(tabs)/_layout.tsx` is deleted. The URLs stay `/`, `/trails`,
`/activities`, `/settings`, so `+native-intent.ts` and `useIncomingShare` (`/trail/new?uri=`)
are untouched (D3).

**Returning to the map** (D45). One helper, used by every path in §3. It calls
`router.dismissTo('/')`, which pops to the existing Map or replaces the current screen with one when
there is none (cold-start Open with). `router.navigate('/')`, used today from the tabs
(`trails.tsx:65`, `activities.tsx:34`), would push a second Map from a stack screen and is not used.
`useGoBackOrHome`'s `/trails` fallback (`new.tsx:26`) goes.

**Shared header** (D47). The root `Stack` in `app/_layout.tsx` sets one custom `header` for every
screen (title, back, recording banner), and `index` sets `headerShown: false`. Each title is
declared once, in its `Stack.Screen` options there, so a screen's loading state shows its title
rather than the route name; no screen renders a header of its own. Save activity, the end of the
recording, sets its own `header` option without the banner. `ListScreen` and Settings carry no
title or top inset.

**State.**

- `preferencesStore` (`src/settings/preferencesStore.ts`): `elevationGraphPlacement`, its
  `ElevationGraphPlacement` type, its setter and its `partialize` entry go (D63); the store keeps
  `paceSpeedMode` and `elevationSmoothingMeters`. A placement stored by an earlier build is read by
  nothing and leaves storage on the next write, since `partialize` omits it; no migration.
  `paceSpeedMode` picks between pace and speed over the window of §4.2.
- `mapStore`: the card's position (collapsed / open) is session-only, never persisted (AGENTS.md
  "persist the minimum"). Selection unchanged.
- The card's open state is derived from its live position (gorhom's `animatedIndex`,
  `useSheetOpen`), the value the nav row's reveal already reads, never from `onAnimate` /
  `onChange`: those do not fire when a drag over-pulls past the open snap point, which left the card
  visibly open but counted as collapsed (B1). Everything that depends on open reads that one value:
  the nav row's taps, the pip's label and toggle, the back handler, the open-height measurement.
- No new persisted state, one less (the placement); no schema change. No new location port member:
  the graph puck uses the recording's points only (D42).

**New pure logic** (TDD, `__tests__`):

- `currentPace` (in `src/recording/`, beside the metrics helpers): points grouped by segment →
  `{ distanceMeters, movingSeconds } | null`. Named cases: window inside one segment; window
  across a pause (gap skipped, not reset); interpolation at the 1 000 m mark; a 20-minute stop
  without pause (excluded); under 200 m (`null`); 200 m–1 km (everything walked); a relaunch gap.
- `stepAlongTrail(state, point, trail) → state`, the T-23 fold (in `src/elevation/`). Replay is
  the fold over all points. Named cases: T-23's scenarios (out-and-back, shared loop,
  leave-and-rejoin elsewhere, GPS glitch, same-direction overlap rejoin, cold start on overlap,
  figure-8, backwards), plus "replay equals step-by-step". The candidate search over a long trail
  uses a spatial index (a 3 h recording is about 10 000 points).
- `pillContent(state)`: a discriminated union, `figures | paused | trail | activity | none`, with an
  optional warning, the way `streamHealth.ts` maps health to text.
- `selectTrailWhileRecording(current, next) → 'along' | 'ask' | 'same'` (§4.7).
- `menuPlacement(anchor, menuHeight, window) → 'up' | 'down'`.
- `sheetRest(mode, graphShown, navRowHeight, systemInset)` (`src/map/sheetRest.ts`): the card's
  resting geometry per state: its kind (`nav` | `graph`), the card's own height (gorhom's first snap
  point: the nav row, or the pip row with the plot under it when shown, `sheetHeader.ts`), its bottom inset (max(16 dp margin, `insets.bottom`),
  gorhom's `bottomInset`, D74), and the height it covers from the window's bottom (the two summed),
  which the camera and the overlays read, and the nav row's height (the nav card itself, the open
  card's footer), its one source for the snap points and the details' scroll. Named cases: the nav card; the graph card with no profile
  (the 44 dp pip row only); with a profile (20 dp + the plot); a system inset smaller than the
  margin (bottom inset = the margin), larger (= the inset) and zero (= the margin), in every kind;
  the covered height counts both.
- `sheetSnapPoints(rest, detailsHeight, windowHeight)` (`src/map/sheetSnapPoints.ts`):
  the open height = the resting card (pip row + graph) + details + nav row, capped so the card's **top** sits at 80% of
  the window, the card's bottom inset counted (today the cap is 80% of the window height with the
  sheet on the floor). Named cases: the cap with a bottom inset; open stays above rest.
- `overlayGeometry` (`src/map/overlayGeometry.ts`): `sheetHeightAbove(rootHeight, cardTop)` and
  `overlayBottom` ride the card's live top edge: 12 dp above it, in every state; a top of 0 (not yet
  laid out) and a top at or past the bottom edge (parked) read as no edge. Named cases: the collapsed graph card, the nav
  card, the open card.
- `cameraPadding(topInset, pill, rest)` (`src/map/cameraPadding.ts`): pill bottom, and the resting
  card's covered height (its margin included) → fit and follow padding. Named cases: the graph card
  with and without a graph, the nav card.
- `fitCameraFor(box, view, padding, heading)` (Mapbox adapter): the fit's centre and zoom from
  nothing but the box, the view and the padding, never stacked on the padding following leaves on
  the camera (B2). Named case: the 2 km loop of the device look framed at walking scale.
- `elevationAxis(min, max) → the plotted range and up to three round labels inside it` (in
  `src/elevation/`), and `axisLayout` placing them (lowest point on the bottom edge, 6 dp headroom,
  each label's baseline in the plot just above its gridline, under it near the top, its digits
  inside the plot at font scale 1 and 1.3). Named cases: the plot spans the profile; the "200 m · 250 m · 300 m"
  example; no label past the lowest point (1150–1998 m); a high-mountain range; a range below 0 m;
  never more than three; a near-flat profile widened to 10 m.
- `statusBarStyleOverMap(tone)` (`src/map/statusBarOverMap.ts`): dark icons over a light layer,
  light over a dark one, whatever the theme; `useCurrentMapStyle` resolves the shown layer for the
  canvas and the status bar alike.
- `pipRow(graphShown)` (`src/map/sheetHeader.ts`): the pip row's laid-out height and how far its
  touch target reaches below it, and `sheetHeaderHeight` from it. Named cases: over a graph, 20 dp
  laid out, reaching 24 dp down over the plot; with no graph, 44 dp laid out, reaching no further.
- `scrubShowsOnTouch(y, coveredTop)` (`src/elevation/graphGeometry.ts`): whether a touch shows the
  scrub as it lands, false in the band at the plot's top under the pip's target (the scrub then shows
  once the drag is claimed). Named cases: below the band, in it, and no band.
- `graphLook(colours)` (`src/elevation/graphLook.ts`): the one look, each band's colour with its fade
  (stops 1 / 0.45 at 0.6 / 0 at the floor, D79), with
  `slopeFlatOnPanel` for flat, the line in `onSurface`, the axis in `onSurfaceVariant`; no
  placement argument, no `halo` member (D64). Named cases: both themes; the flat fill
  stands out from the card's surface. The tests of the floating look go with it.
- `cardSurfaces(colours)` (`src/map/cardSurface.ts`): the card's surface at its two snap points,
  `pillSurface` collapsed and `surface` open, which `CardFrame` blends on the live index (D72); the
  same theme-to-look shape as `graphLook`. Named cases: both themes.

**Components.**

- New: `MapStatusPill` (replaces `src/map/MapModeChip.tsx`), `SheetNavRow` (the card's footer),
  `AppHeader` with `RecordingBanner` (the root header), `CardFrame` (`src/map/CardFrame.tsx`): the
  card as seen, rendered as the sheet's child, its height the sheet's live height above gorhom's
  container (`sheetHeightAbove`); its surface interpolated from `pillSurface` collapsed to `surface`
  open on the live index (`cardSurfaces`, `src/map/cardSurface.ts`), 16 dp corners, the pill's `boxShadow` (one theme token, read by
  `MapStatusPill` and `CardFrame`; the control buttons keep their elevation shadow, `MapTokens.controlShadow`) (D72); it clips the
  content and pins the nav row to its bottom. Neither gorhom's background nor its `style` can be the
  card: gorhom's sheet body is as tall as the open snap point and slides past the container's bottom
  when collapsed, unclipped in `detached` mode.
- Changed:
  - `MapInfoSheet` (`src/map/MapInfoSheet.tsx`): the card. Always mounted, gorhom `detached` with
    `bottomInset` = max(16 dp margin, `insets.bottom`) and 16 dp horizontal margins on the sheet's
    style; no gorhom handle, background or footer slot: the card, with the nav row pinned to its
    bottom, is drawn by `CardFrame` (above). Nothing shown and idle, the nav card: the nav row and
    no pip or gestures; otherwise snap points `[collapsed, measured open height]`, the second set
    only while collapsed; dynamic sizing stays off (its comment's reason holds); open derived from
    the live position; back to the resting position on a change of state; scrollable details;
    tap-to-toggle pip (`CardPipRow`, 20 dp: the pip 8 dp inside the top edge and 8 dp above the
    graph, its touch target at least 44 dp, reaching over the graph's top, D73; with no graph, 44 dp
    laid out and reaching no further); the details clipped at the nav row's top edge, which has no
    surface of its own; the graph under the
    pip in its draggable content, shown at every height (D60). The two placement branches
    and the `panelTop` background offset go.
  - `MapScreen` (`src/map/MapScreen.tsx`): pill instead of chips, no status-bar scrim; no
    placement read from the preferences; `sheetRest` fed with whether a graph
    is shown; overlays 12 dp above the card, riding its top edge, hidden past half height (the
    graph stays on the card); a `sheetTop` of 0 means not yet laid out and, like a parked position
    at or past the bottom edge, reads as no card (`sheetHeightAbove`, `overlayGeometry.ts`).
  - `ElevationGraph` (`src/elevation/ElevationGraph.tsx`): no `placement` prop; the one look with
    the y-axis; the gradient `Defs` and the halo paths go; puck; its vertical drags
    go to the card; the scrub tooltip floats over the top of the plot and reserves no row, so
    `GRAPH_HEIGHT` is the plot's height (D73).
  - `RecordButton` / `PausedControls`: 48 dp, no caption.
  - Settings (`app/settings/index.tsx`): the "Elevation graph" chips and `PLACEMENT_OPTIONS` go;
    the smoothing chips stay.
  - `colors.ts`: `graphLine` and `graphHalo` go with the floating look (their only reader is
    `graphLook`); `slopeFlat` stays, the map route's flat colour.
  - `RecordingInfoSheet`: the Along row, the trail name wrapping; the trail's summary row
    (`TrailSummaryRow`, as `TrailListItem` draws it); the ahead lines; the description (D95). It
    takes the trail, the route display and the puck.
  - The trail's metrics grid is the trail card's alone again (D95); only the description is shared
    by the two cards.
  - `trailAhead` (`src/elevation/`, beside `trailProgress`) and its formatter
    (`formatTrailAhead`, `src/trails/format.ts`): pure; revised by
    [[2026-11-09-walking-time-ahead-design]] (D84–D87), whose Testing Decisions name its cases.
  - `MetricsGrid`: three equal columns, wrapping to a new row, a gap between rows; values in
    tabular digits on one line, labels centred over up to two lines (D82).
  - Route overlays (map port and Mapbox adapter): each overlay declares its **tier**, the shown
    route or the live track; the adapter stacks the tiers in that order whatever order they mount
    in, a style reload included (D83). Inside a tier, an overlay's lines, then its markers; with
    terrain on the markers draw above the lines of both tiers (D102).
  - `TrailInfoSheet` / `ActivityInfoSheet`: ⋮, metrics, the name wrapping.
  - `EntityListItem`: one ⋮ slot for both list items; `TrailListItem` / `ActivityListItem` lose
    their inline icons.
  - `ActionsMenu`: placement up or down; its comment about the tab bar goes.
  - `src/trails/trailActions.ts`: Edit and Delete added; a new `activityActions.ts` beside it.
  - `offlineStore`: publishes a per-trail "download settled" event (ready / failed) once all its
    packs settle; a root listener shows the toast. The store itself shows no UI.
  - `useSheetBackDismiss` pattern reused for the Map's back handler, gated on focus.
- Removed: `app/(tabs)/_layout.tsx`, `MapModeChip.tsx`, the four metrics tiles of the live sheet.
- Toasts through the existing `showToast` (`src/components/toast.ts`, a plain `ToastAndroid` that
  neither queues nor merges): no write shows more than one toast.
- Debug log: one `info` line per change of the recording's trail (`area: recording`), no
  coordinates.

**Seams.** No native SDK is touched outside its seam; no new boundary.

## 7. Dependencies outside the scope

None. Everything is in this app. `T-23` (recording half) and the display half of `T-38` become part
of this feature; their tickets close with it. `T-30` (default activity title), `T-15` (edit
activity) and `T-11` (export) have a slot in the activity ⋮ and Save form, and ship separately.
Position jumps kept into the track (the fix gate's job) weigh more in a 1 km window than in a
whole-walk average; the window's stationary rule does not filter them.

## Existing shape

- **Navigation shell**: today's `(tabs)` layout is the first and only shell; it is replaced, not
  forked. Pushed screens already exist (`/settings/offline`, `/trail/new`); Trails, Activities and
  Settings join them under one shared header. `ScreenHeader`, the per-screen title, is deleted:
  titles are declared once in `app/_layout.tsx`.
- **Map card**: `MapInfoSheet` already hosts three content kinds (`TrailInfoSheet`,
  `ActivityInfoSheet`, `RecordingInfoSheet`). It stays the one component and becomes the card: the
  same gorhom bottom sheet in `detached` mode with a `bottomInset` and horizontal margins, not a
  second window or a new container (D62). It is always mounted (on master it mounts only with
  content, `MapScreen.tsx:134`). Its fixed-snap-point contract is kept: the open height is
  measured, not dynamic. `sheetRest`, `sheetSnapPoints`, `overlayGeometry` and `cameraPadding`
  stay the one geometry and take the margins in; nothing is written twice for the nav card.
- **Top pill**: `MapModeChip` is the first instance of a top status slot. It is replaced by
  `MapStatusPill`, which absorbs its three uses and the recording status; nothing else draws at the
  top.
- **Action menus**: `ActionsMenu` + `trailActions.ts` + `offline/menu.ts` are the first instance.
  The activity menu is the second, so the shape is shared: one function per entity builds its
  actions, `ActionsMenu` renders them in the card and in the list rows, and `EntityListItem`
  gains the ⋮ slot once for both. `TrailActions` and `ActivityActions` hold each entity's menu
  wiring, used by its card details and its list alike.
- **Return to the map**: `useGoBackOrHome` and `save.tsx`'s pop-don't-replace rule are the first
  instance; the helper generalises them, and every caller uses it.
- **Back handling**: `useSheetBackDismiss` is the precedent for the Map's back handler.
- **Trail specs** *(revised D95)*: the trail card's metrics and description were extracted once
  (`TrailSpecs`) when the recording card became the second instance (D81). Since D95 the recording
  card shows no metrics grid, so the grid goes back to the trail card and only the description stays
  shared (`TrailDescription`), which the recording card draws set apart (D98).
- **Trail summary row** (D95): the Trails list's row is the first instance (the difficulty
  `EnumBadge` leading `formatTrailSummary` on one line, D97); the recording card is the second, so
  the row is extracted as `TrailSummaryRow` (`src/trails/`) and both draw it. The markup every
  entity's summary shares, the badge leading the first summary line, the other lines under it, in
  the secondary text (D97), is extracted from `EntityListItem` as `EntitySummary`, which takes the
  badge as its enum field and value and which `TrailSummaryRow` and `ActivityListItem` draw;
  `EntityListItem` takes the summary as a slot under the title.
- **Trail ahead**: `trailProgress` (`src/elevation/`) is the sibling, pure logic over the trail's
  profile for a recording along it, which gives the puck's `s`. `trailAhead` sits beside it and
  reads that `s` against the trail's profile; since D85 its climbs come from their own rule, not
  the graph's bands. Nothing is shared: one places the walker on the trail, the other reads what is
  left past that place.
- **Metrics**: `MetricsGrid` stays for the trail and activity details and the forms; the trail card
  and the trail form show the same three tiles, built once (`trailMetricTiles`, `src/trails/format.ts`). The pill is not
  a grid: four fixed figures in one row with large type. It shares the formatters (`src/format/`,
  `src/activities/format.ts`), not the component.
- **Elevation graph**: master's `ElevationGraph`, with its two placements and their two styles, is
  the first instance, and stays the one graph component, now with one look: the surface one, with
  the y-axis. Master's floating look (gradient fill, `graphLine` on `graphHalo`) is deleted, not
  kept behind a flag (D64). The placement chips are gone; Settings keeps the one `SettingsChoice`
  for "Elevation smoothing" (D63).
- **Card surface**: `graphLook` is the first instance of a theme-to-look function; `cardSurfaces`
  (`src/map/cardSurface.ts`) is the second, of the same shape: the theme's colours in, the card's
  two surfaces out, the one source `CardFrame` blends between.
- **Toasts and alerts**: the existing `showToast` and `Alert`, no new feedback mechanism.

## Failure modes

| Degraded mode | Visible outcome | Recovery |
|---|---|---|
| Location off while recording | Pill warning line "Location is off · Recording continues when it's back on." | Turn location on; the line disappears. |
| Capture stopped while recording | Pill line "Not recording location" (+ the permission hint when that is the cause) with Retry | Retry, or fix the permission in system Settings. |
| Permission denied at start | Today's alert; the button stays Start | Grant and tap Start again. |
| Under 200 m walked | Pace `—` | Fills in at 200 m. |
| Stop without pressing Pause | The stop does not count in the pace window | — |
| GPS jump kept into the track | The pace is off for up to 1 km | Clears as the window moves on. |
| Fewer than 2 elevation samples | No graph: the collapsed card is the pip row only, the overlays 12 dp above it | Appears with the second sample. |
| Flat or near-flat profile | Drawn over 10 m around its middle, so it reads flat; one or two round labels inside | — |
| Off the recording's trail | No puck on the graph; the map shows the track leaving the trail; the open card's ahead lines become the one line "Not on the trail" | Puck and ahead lines return once back within R. |
| Recording along a trail with no elevation profile | No puck, no bands, so no ahead lines ("Not on the trail" would be false); the rest of the open card as normal: the Along row with its summary row and the description, set apart (D95, D98) | — |
| Walking the trail against its direction | The ahead lines' distance, time and climbs count toward the trail's own end | — |
| Relaunch mid-recording, the trail loading after the track | The recorded track's line stays drawn above the trail's lines, the trail's arrows and dots above it (D83, D102) | — |
| Recording's trail deleted | Recording carries on along no trail, toast "Trail deleted · Recording without a trail" | — |
| Recording's trail fails to load | Same, toast "The recording's trail is no longer available" (today silent, F26) | — |
| Large system font | Pill figures shrink to fit, never truncate | — |
| Collapsed card over a bright or busy map | The card is translucent (70%, the pill's surface): the graph's bands, line and y-axis labels stay readable over the faint map; the details' text appears only as the card turns opaque with the pull | Pull the card up for an opaque surface. |
| System inset taller than the card's margin (three-button navigation) | The card sits on top of the inset, never over the system buttons; the bottom margin is the inset | — |
| Swipe up started on the card's lowest few dp | May go Home (the system's gesture zone lies in the bottom margin) | Start the swipe on the pip or the graph, well above it. |
| Card details taller than 80% | Details scroll; the nav row stays pinned and visible; the card keeps its margins | — |
| Details change while the card is open | The card does not move; the new height applies on the next opening | — |
| A drag over-pulls the card past its open position | The card counts as open: the nav row takes taps, the pip says "Show less", back collapses it | — |
| What is shown changes while the card is open | The card goes to the new state's resting position | Pull it up again. |
| Card open past half height | Map controls and record button hidden; the graph stays at the top of the card, below the pill (80% cap, margins counted) | Lower the card. |
| Screen reader | The pip toggles the card by tap and accessibility action; nothing shown and idle, the nav card's buttons are on screen | — |
| Offline (no network) | No change: offline maps are a provider invariant (ADR 0002); tiles not downloaded stay blank, as today | — |
| App killed during a recording | Relaunch on the Map, pill with the figures, existing toast "No position between HH:MM and HH:MM"; the graph puck is replayed | — |
| Cold-start Open with during a recording | After "I'm done", the Map replaces New trail (none underneath), recording intact | — |
| Save or delete fails | Today's alerts; delete activity gets a toast instead of nothing | Try again. |
| Back from Save activity | Back on the Map, still paused, pill "⏸ Paused" | Resume or Stop. |
| Render-time throw in the pill, card or header | Existing ErrorBoundary screen | "Try again". |

## Verification

Pure logic: the named test cases of §6, written first.

On the device (`device-check`), each check failing in the broken case:

1. With gesture navigation, a swipe up starting on the pip opens the card and does not go Home; a
   tap on the pip opens it. (Feel of the gesture: owner.)
2. A vertical drag on the graph moves the card (upward opens it); a horizontal drag scrubs.
3. A trail with a long description, card fully open: the details scroll, the nav row stays visible,
   controls and record button are hidden, the graph stays at the top of the card and its vertical
   drag still moves the card, the card keeps its 16 dp margins, nothing sits under the pill.
4. A download running with the card open: the card does not move on its own.
5. Collapsed card: nothing of the details peeks between the pip row and the card's bottom edge, and
   the map shows in the margin under the card (screenshot).
6. Push Trails, tap a row: one Map only (no second `map mode` log line, camera unchanged), the
   trail framed clear of the pill and of the card, and filling the band between them: a 2 km trail
   is not framed at city scale; same for "Frame the whole route" on a shown activity.
7. Font scale 1.3: "1:12:05", "12.4 km", "1 412 m" and "⏸ Paused" show untruncated.
8. `walk.sh` walk with a 10-minute stop and no pause: the pace is back to walking pace within a
   minute of walking again. Pause, then resume: the pace does not go back to `—`.
9. Cold-start Open with during a recording: "I'm done" lands on the Map with the recording.
10. ⋮ on the first card of the Trails list: the whole menu is on screen.
11. A two-layer download: one "Offline map ready" toast, after both packs.
12. A drag that over-pulls the card open, with a trail shown: a tap on Settings opens Settings, the
    pip's label is "Show less", Android back collapses the card and does not leave the app.
13. Nothing shown and idle: the nav card is on screen with the same margins as the graph card, a
    swipe up on it does not move it, it has no pip, the record button and controls sit 12 dp above
    it.
14. Save an activity with the recording card open: the Map shows the activity with the card
    collapsed; clearing a shown trail from an open card lands on the nav card.
15. The card floats with 16 dp margins in every state (nav card, collapsed graph card, open graph
    card), equal on the sides and the bottom (measured on a screenshot), the gesture bar in the
    bottom margin; its corners rounded; translucent collapsed and as the nav card, opaque open, the
    change following the drag, in both themes; the shadow around the card and no dark smear inside
    it; the pip sits 8 dp inside the top edge and 8 dp above the plot, no empty band between them, a
    tap just under the pip toggles; the scrub tooltip shows over the plot, not clipped by the card's
    top edge; a pan starting in the bottom margin under the card moves the map; the open card keeps
    its margins and never reaches full width; the idle nav card does
    not move; the graph has the y-axis (up to three round labels, the lowest point on the plot's floor) and the surface look; Settings has no
    "Elevation graph" chips, and the persisted `onfoot-preferences` entry holds no
    `elevationGraphPlacement` after a change of smoothing.
16. Recording: no caption under the button; status icons straight on the map in both themes.
17. A trail, an activity and an Along trail with a name longer than one line: the card shows the
    whole name, wrapped, with ⋮ or ✕ beside it on screen; the pill keeps it on one line.
18. Screenshots, both themes: the nav card (nothing shown), and with a trail the collapsed graph
    card and the open graph card, for the owner's look at the margins, corners, shadow, the map
    showing around the card and faintly through it collapsed, and the graph's labels readable on the
    translucent card.
19. A trail with no elevation: collapsed, the card is 44 dp with the pip 8 dp inside its top edge;
    open, a tap anywhere on the title row's ⋮ opens the menu and does not toggle the card. With a
    graph, a tap just under the pip toggles the card with no scrub cursor, tooltip or map marker
    flashing; a touch lower on the plot shows the scrub at once. Mid-pull, no band where the nav row
    sits.
20. Dark theme, Outdoors layer: the status icons are dark on the Map; Satellite: light; open
    Trails: the theme's icons return. The graph's lowest point touches the plot's floor with no
    empty band of colour under the profile, no label lies below the lowest point (a profile flatter
    than 10 m excepted, §4.4), and 12 dp of the
    card show under the graph, collapsed and open (screenshot).
21. Recording along a trail, the card open: the Along row, the summary row (badge, distance and
    gain), the ahead lines in the primary text (distance and walking time left; next climb or climb
    in progress, D84, D94, D99), then the description behind a divider (D98), no metrics grid (D95); the
    badge and the summary on one line, there and in the Trails and Activities lists (D97); walking
    away from the trail turns the line into "Not on the trail"; along a trail with no elevation
    profile, no ahead lines and the rest of the card unchanged.
22. The activity card's metrics: three to a row, values apart, labels never touching, both themes.
23. Recording along a trail, kill the app and relaunch it: the recorded track is above the trail
    wherever they overlap; switch the layer: still above.
24. Recording along a trail, at the profile's lowest and highest points and at its first and last
    metre: the graph puck's centre on the line, the puck whole, reaching into the card's margin (D96).

## 8. Decisions (owner, 2026-11-06, unless marked)

| # | Decision | Reason |
|---|---|---|
| D1 | One user, the owner, on one Android phone, held in one hand outdoors. | Only user today. |
| D2 | Jobs in order: (1) am I on track, (2) read my figures, (3) start/pause/stop. Planning and review come after. | Owner. |
| D3 | Kept: Expo Router, the seams, glossary words, the share/Open with import route, the debug log. Everything else open. | Other apps rely on the route; the rest is the app's own. |
| D4 | Scope: whole-app navigation plus the hiking view in detail; ticketed features get a slot only. | Removing the tab bar moves every screen's entry. |
| D5 | The map stays full screen while walking. | Job 1 is "am I on track". |
| D6 | Pace is over the rolling last 1 km. Average pace moves to the saved activity. | Owner wants current pace, not the whole-hike average. Refined by D41. |
| D7 | Elevation gain stays in the walking view. | "Elevation is important." |
| D8 | Navigation lives at the bottom of the bottom sheet, revealed by pulling up. | Owner's earlier idea. The search found no written trace; taken as the proposal. |
| D9 | Changing the recording's trail asks for confirmation. | Today it is silent; activities already refuse. Extended by D46. |
| D10 | One action menu per entity, the same wherever it appears. | Trail actions were split across two places. |
| D11 | Four figures in the pill: time, distance, pace, gain. The graph is the trail and your position, not activity stats. | Owner. |
| D12 | One top slot, one sentence per state; it replaces the chips. | "Paused" said twice; nothing at the top while recording. |
| D13 | A puck on the graph (T-23); no colour difference between walked and unwalked parts. | Owner. Limited to recording by D42. |
| D14 | No off-trail warning in this feature. | "If the user is watching his screen, he can see that he's off trail." |
| D15 | All map controls kept, all on the map. | Owner uses them all. |
| D16 | *Revised 2026-11-07 (owner, device look):* hold-to-pause kept; no caption, the short-tap toast "Hold to pause" teaches the hold (D56); Stop only after pause. *Revised 2026-11-07 (owner, after use):* 48 dp button (D61), first 56 dp. First decided with a "Hold to pause" caption under the button. | Protects against pocket taps; the hold was invisible. The owner found the caption unneeded on the device. |
| D17 | After saving an activity: toast "Activity saved" and the activity shown. | Today it lands on an empty map. |
| D18 | *Revised 2026-11-07 (owner, second look):* the always-present sheet is a floating card with margins from the screen edges (D62); pulled up it shows the details and the nav row; the tab bar goes. First decided as a full-width sheet on the floor of the screen. | Owner, with D15 (controls stay off the card). An empty full-width strip at the bottom felt weird under a floating graph. |
| D19 | The record button floats bottom-left. | Owner: a big centred button in the sheet attracts the eye and eats map; bottom-left is discreet. |
| D20 | Trails, Activities and Settings are full screens pushed over the map. | Lists need height; back is a reliable way home. |
| D21 | Navigation stays available while recording; a recording banner on pushed screens returns to the map; opening an activity stays refused. | Today nothing outside the map shows a recording. |
| D22 | Two sheet positions; the open height fits its content. | Today's 55% is mostly empty. How it is measured: D43. |
| D23 | Recording along no trail → the live elevation profile. | Owner. |
| D24 | *Revised 2026-11-07 (owner, second look):* the collapsed graph card holds no action, only the pip and the graph (D62, D67). First decided as "the handle (and the graph, D27)" on a sheet. | Follows D19. |
| D25 | *Revised 2026-11-09 (owner, after a hike):* revised by D81: under the Along row, the ahead line, then the trail's difficulty badge, metrics and description. First decided as "Open recording sheet: Along row, nav row". | The figures are in the pill. On the hike, the trail's specs and description were visible nowhere while recording. |
| D26 | Location problems show as a second line in the pill, with Retry, while recording. | State you must see without pulling anything. |
| D27 | *Revised 2026-11-07 (owner, second look):* the setting is removed for good; the graph is the card's header, one placement (D63). *Revised 2026-11-07 (owner, device look):* the graph's placement was a setting again, Floating by default (D51). After the challenge it was "the graph is the collapsed sheet's header in every state, the setting removed"; first decided as "keep the setting". | On a card, "Floating" and "In sheet" describe the same thing: the graph over the map, on a panel with margins. The challenge's reason (In sheet hid the graph while walking) no longer holds either, since the graph is the collapsed card's header. |
| D28 | "Along {trail}" for the trail; Follow for the camera only. | One word per meaning. |
| D29 | Tap the pace figure to switch pace/speed; the unit label shows which. | Kept from today. |
| D30 | *Revised 2026-11-07 (owner, device look):* nothing shown, idle: the sheet is a fixed bar showing the nav row (D58). First decided as "handle only; open, only the nav row". | Owner, "for now"; the device showed the empty collapsed sheet was hard to grab. |
| D31 | Unified ⋮ menus for trails and activities; inline row icons removed. | Follows D10. |
| D32 | After importing a trail: toast "Trail added", trail shown on the map. | Same as D17. |
| D33 | Offline maps screen stays the storage manager; tapping a trail shows it on the map. | Download stays where the trail is. |
| D34 | Back collapses the sheet, otherwise default. Clearing stays the pill's ✕. | Owner. |
| D35 | *Revised 2026-11-07 (owner, device look):* translucent pill (light/dark), four figures with labels; no status-bar scrim (D57). *Revised 2026-11-07 (owner, after use):* figures about 21 sp (D61), first about 24 sp. First decided with a scrim. | Ticket T-14. The owner prefers the status icons straight on the map. |
| D36 | Small defects found in the audit are listed for tickets, not designed here. | Owner. |
| D37 *(designer)* | Start while an activity is shown ends the activity view and starts recording. | Today the button vanishes without explanation. Confirmed by D49. |
| D38 *(designer)* | Speed in the pill uses the same window as pace. | The toggle stays a pure unit change. |
| D39 | *Revised after the challenge:* deleting the recording's trail ends the Along with a toast. First decided as "Delete disabled while the trail is used" (designer). | Owner: very unlikely mid-hike, either is fine. The simpler one needs no new menu-item fields. |
| D40 | *Revised after the challenge (designer):* a download's end shows one toast per trail ("ready" / "failed"), fired from a root listener; no toast at its start. | Toasts on Android neither queue nor merge; per-pack toasts would arrive late and in bursts. The badge already shows the start. |
| D41 | *After the challenge:* the pace window skips segment gaps, interpolates at 1 km, ignores steps slower than 0.5 km/h; under 1 km it covers everything walked, `—` under 200 m. | Moving time is wall time minus pauses, so an unpaused lunch dragged the pace for a km; "—" for the first km was a poor main figure. |
| D42 | *After the challenge:* no graph puck outside a recording. | No position reaches the app outside a recording, and one position cannot place you on an out-and-back. The map's own puck is unchanged. |
| D43 *(designer, after the challenge)* | *Revised 2026-11-07 (owner, device look):* the open height is measured and applied only while collapsed; details scroll past 80%; the nav row is pinned as the sheet's footer; the map controls and the record button hide past half height (the floating graph stays, D60); an open sheet never moves on its own within a state, and goes to the new state's resting position when the state changes (D59). First decided with "never moves on its own" in every case. | A content-driven height moved the sheet on its own (the reason dynamic sizing is off today), and a tall sheet pushed the controls under the pill. Across a state change, staying open kept the recording's height over the saved activity (`18-after-save.png`, `21-activity-open.png`). |
| D44 *(designer, after the challenge)* | Camera fit and follow padding come from the measured pill and sheet. | The fixed top padding put a framed trail under the pill. |
| D45 *(designer, after the challenge)* | One return-to-map helper on `router.dismissTo('/')`. | `router.navigate('/')` from a stack screen pushes a second Map. |
| D46 *(designer, after the challenge)* | The trail-change rule of D9 applies to every path that shows a trail. | The first draft had import and the offline-maps tap change the recording's trail silently. |
| D47 *(designer, after the challenge)* | One custom header in the root stack carries the title, back and the recording banner. | `ScreenHeader` renders nothing in the screen body, and three screens use neither it nor a native header. |
| D48 *(designer, owner's delegation)* | *Revised 2026-11-07 (owner, device look):* superseded by D58: when nothing is shown and idle the nav row is on screen as a fixed bar. First decided as "the nav row stays hidden; a pull opens it". | Map space first, "if use says otherwise": on the device it did, the empty collapsed sheet was hard to grab. |
| D49 *(designer, owner's delegation)* | Start while an activity is shown ends the view and starts (confirms D37). | A hidden button with no reason is worse; a wrong start is undone by Discard. |
| D50 *(designer, owner's delegation)* | The pace window stays 1 km. | The owner's wording; the stationary rule already removes the worst drag. Tunable in one constant. |
| D51 *(owner, 2026-11-07)* | *Revised 2026-11-07 (owner, second look):* superseded by D62 and D63: the setting goes, the graph is the header of a floating card. First decided as: the "Elevation graph: Floating / In sheet" setting is back, default Floating, persisted; Floating: the collapsed sheet is the handle row only, at the very bottom, and the graph floats just above it; In sheet: the graph is the collapsed sheet's header. Revised D27. | The owner preferred the graph over the map, above the sheet; on the device the Floating mode's empty handle-row strip under the graph "feels weird", and a card gives the graph over the map without the strip, so the two modes collapse into one. |
| D52 *(owner, 2026-11-07)* | *Revised 2026-11-07 (owner):* the floating graph: a vertical drag opens the sheet, a horizontal drag scrubs; it rides the sheet's top edge at every height (D60). First decided as "hides past half the screen with the controls (D43)". | It keeps the graph a grab area, the reason D27 had moved it into the sheet. The hiding went with D60. |
| D53 *(owner, 2026-11-07)* | The map controls and the record button always sit above the floating graph, never level with it, as on master; the camera's bottom padding includes the floating graph. | As on master; a framed trail must not sit under the graph. |
| D54 *(owner, 2026-11-07)* | *Revised 2026-11-07 (owner, second look):* one look, the surface one (D64): flat fill at 0.7 opacity, flat band `slopeFlatOnPanel`, line in `onSurface`; master's painted-on-map look is deleted. First decided as master's two styles, one per placement: floating = exactly master's gradient fill, light-grey flat band, dark line with a white halo; in sheet = master's flat fill and `onSurface` line, with the flat band in a theme-aware grey (a named theme colour, light and dark) instead of the sheet's colour (owner's ruling Q17, 2026-11-07). | The painted-on-map style was made for a graph with the map behind it; on an opaque card the graph has a plain surface behind it, which is what the in-sheet style was built for, and it keeps the theme-aware grey that fixed the white-on-white flat stretches (`23-after-trail-save.png`). |
| D55 *(owner, 2026-11-07)* | *Revised 2026-11-07 (owner, second look):* the y-axis is on the graph in every state, since the card is the one placement (D64). First decided as In sheet only, "Floating: no axis, for now". Three round elevation labels (low, middle, high) in a left gutter with faint gridlines, about 11 sp in `onSurfaceVariant`; the plot narrows, scrub and puck map to it. No x-axis. | The card has the room and the plain background; the scrub tooltip already gives distance. |
| D56 *(owner, 2026-11-07)* | No "Hold to pause" caption; the short-tap toast and the accessibility label stay; the gap between the overlays and the graph or sheet is 12 dp; the 56 dp buttons stay (48 dp since D61). Revises D16. | The 24 dp gap existed only for the caption. |
| D57 *(owner, 2026-11-07)* | No status-bar scrim, in either theme; the pill is unchanged. Revises D35. | The owner prefers the status icons straight on the map. |
| D58 *(owner, 2026-11-07)* | *Revised 2026-11-07 (owner, second look):* the fixed bar is the nav card: the same card with its margins, corners and shadow, holding the nav row only; no pip, not draggable (D69). First decided as a fixed full-width bottom bar. Nothing shown, idle: it shows the nav row and neither collapses nor opens; the record button and controls sit above it. Revises D30 and D48. | An empty collapsed sheet was hard to grab; once everything else floats, a full-width bar would be the one thing glued to the edge. |
| D59 *(owner, 2026-11-07)* | When what is shown changes (nothing, trail, activity, recording), the sheet goes to that state's resting position: collapsed, or the fixed bar when nothing is shown and idle. D43's "an open sheet never moves on its own" holds within a state only. | After saving an activity the sheet stayed open at the recording's height, the activity's details cut off (`18-after-save.png`, `21-activity-open.png`). |
| D60 *(owner, 2026-11-07)* | Floating graph always visible; it lives in the sheet's draggable content (gorhom can attach drag only inside the sheet) and the 80% cap counts it, so it never reaches the pill. Revises D52. | Owner: "keep the graph always visible"; a hidden graph left an invisible strip that captured map drags. |
| D61 *(owner, 2026-11-07, after use)* | Sizes after use: figures 21 sp, record buttons 48 dp, nav icons as master's tab bar; names wrap in the sheet. Revises D16, D35 and D56. | After a walk with the build, the figures and the record button felt too big, and long trail names were cut while the sheet has room. |
| D62 *(owner, 2026-11-07, after a second look)* | The sheet becomes a card: a floating panel with a margin from the screen edges (gorhom `detached` + `bottomInset`; same component, same gestures, same open/collapsed logic). One card that grows: collapsed it holds the pip and the graph; pulled up, the same card grows upward and shows the details under the graph and the nav row at its bottom. No second window. Revises the shape in D18, D24, D51, D58. | In Floating mode the collapsed sheet was an empty handle-row strip under the graph: "it feels weird to just have an empty sheet at the bottom of the screen". Everything floats over the map as cards. |
| D63 *(owner, 2026-11-07, after a second look)* | The placement setting is removed: the "Elevation graph" chips, `elevationGraphPlacement` and its persistence go; Settings keeps the smoothing chips only. One placement, one code path. Revises D27 and D51 again. | "Floating" and "In sheet" describe the same thing on a card. |
| D64 *(owner, 2026-11-07, after a second look)* | The graph's look on the card is the surface look built for In sheet: flat bands at 0.7 opacity, flat band `slopeFlatOnPanel`, line in `onSurface`, the y-axis of D55 (three round labels, gridlines). Master's painted-on-map look (gradient fill, `graphLine` with `graphHalo`) is deleted with the setting. Revises D54 and D55's "Floating: no axis". | The card is a plain surface, the pill's 85% one collapsed and opaque open (D72); the surface look was built for one, and the map style's point (reading over the map) is gone. |
| D65 *(owner, 2026-11-07, after a second look)* | *Revised 2026-11-07 (owner, first look at the card):* the open card is opaque, the `surface` colour in both themes; collapsed, it is translucent (D72). First decided as opaque at every height, no translucency. | Text over the map is hard to read: the details' text is on the open card. The map showing through the margins around the card is the floating effect wanted. |
| D66 *(owner, 2026-11-07, after a second look)* | *Revised 2026-11-07 (owner, first look at the card):* the bottom margin is measured from the screen's bottom edge, the gesture area inside it, bottom = max(16 dp, `insets.bottom`) (D74); *(designer)* the shadow is the pill's `boxShadow`, one token shared by the pill and the card (D72). Side and bottom margins equal to the overlay padding (16 dp, `overlayPadding`); corner radius 16 dp on all four corners. First decided with the bottom margin above `insets.bottom` and the control buttons' shadow (`ControlButton`: elevation 4, 0.2 opacity, radius 4, offset 2). | The card's edges line up with the pill and the controls. A margin above the gesture inset was twice the side margins on the owner's phone; an elevation shadow smears through a translucent surface. |
| D67 *(owner, 2026-11-07, after a second look)* | *Revised 2026-11-07 (owner, first look at the card):* the pip row is laid out 20 dp (8 dp, the 4 dp pip, 8 dp) with a touch target of at least 44 dp reaching over the graph's top (D73). The pip sits 8 dp inside the card's top edge, above the graph. Tap opens, tap when open collapses ("Show more" / "Show less" unchanged). First decided in a 44 dp pip row. | The pip is the card's visible grab and a target a screen reader can reach; drawn on the card it is discoverable where one drawn on the graph alone was not. The 44 dp row and the tooltip's row left about 48 dp empty between the pip and the plot. |
| D68 *(owner, 2026-11-07, after a second look)* | The open card keeps its margins: same side and bottom margins when open; its top is capped at 80% of the screen. It never snaps to full width. | One shape in every position; a card that grew into a full-width sheet would be two designs. |
| D69 *(owner, 2026-11-07, after a second look)* | Idle = nav card. Nothing shown and idle: a card with the same margins, corners and shadow holding the nav row only; no pip; not draggable, does not open. Record button and controls sit above it. Revises D58 (the fixed full-width bar). | Everything at the bottom of the map is a card; the nav row stays reachable without a pull (D58's reason). |
| D70 *(owner, 2026-11-07, after a second look)* | The nav row is only inside the open card while something is shown; no permanent nav card under the graph card. | A nav row always visible would cost about 56 dp of map while hiking. |
| D71 *(owner, 2026-11-07, after a second look)* | Everything else unchanged: controls and record button 12 dp above the card's top edge and riding it; horizontal drag on the graph scrubs, vertical drag moves the card; graph always visible, controls and record button hide past half height; camera bottom padding = the card's top + margin; pill unchanged; resting position per state (D59); open read from the live index (B1); fewer than 2 samples → the collapsed card is the pip row only. | The card changes the shape of the sheet, not its behaviour. |
| D72 *(owner, 2026-11-07, first look at the card)* | The collapsed card is translucent, the pill's surface (`pillSurface`, white or dark at 85%); it reaches the opaque `surface` as it is pulled open, interpolated on the live index (the value the details' reveal reads). The nav card, which never opens, is translucent like the collapsed graph card. *(designer)* The card's shadow is the pill's `boxShadow`, drawn outside the shape only, one theme token shared by the pill and the card; the control buttons, opaque, keep theirs. Revises D65 and D66's shadow clause. | Owner: the collapsed card can let the map through, the open one holds text and stays opaque. An Android elevation shadow shows through a translucent surface as a dark smear; the pill has the same surface and already uses `boxShadow`. |
| D73 *(owner, 2026-11-07, first look at the card)* | Compact header: the pip row is 20 dp (8 + 4 + 8), just room for the pip above the graph, its touch target at least 44 dp by reaching down over the graph's top (a tap toggles, a horizontal drag still scrubs, a vertical drag still moves the card). The scrub tooltip floats over the top of the plot while scrubbing and reserves no row. The collapsed graph card is the plot plus 20 dp (about 82 dp, was 122); the y-axis's top label stays whole inside the plot. Revises D67's row. | Owner: "the graph takes two-thirds of the container instead of just leaving enough space for the little handle"; measured, about 48 dp empty between the pip and the plot. |
| D74 *(owner, 2026-11-07, first look at the card)* | Equal margins: the card's bottom edge sits 16 dp from the screen's bottom edge, as from its sides, the system's gesture area inside that margin; when the system inset is taller (three-button navigation) the card sits on it: bottom = max(`overlayPadding`, `insets.bottom`). A swipe up starting on the card's lowest few dp may go Home; the pip and the graph, where drags start, are well above it. Revises D66's bottom margin. | Measured on the owner's screenshot: 16 dp on the sides, about 34 dp under the card (16 dp above an 18 dp gesture inset). |
| D75 *(owner, 2026-11-07, second look at the card)* | Over the map, the status bar's icons follow the layer's tiles, not the app's theme: dark over a light layer, light over a dark one. *(designer)* The tone is a semantic field on the provider's layer descriptor (`tone: 'light' \| 'dark'`), required of every provider; Satellite is dark. The Map mounts its status bar style only while focused. Refines D57. | Owner: "The icons in the status bar should be dark, they are not visible on top of the map": in the dark theme they were white over the light Outdoors tiles. Following the tiles keeps them readable on Satellite too, the one dark layer. |
| D76 *(owner, 2026-11-07, second look at the card)* | The pill's and the collapsed card's surface is 70% opaque, not 85% (`pillSurface`, both themes). Revises D35's and D72's figure. | The owner set it on the device and prefers it. |
| D77 *(owner, 2026-11-07, second look at the card)* | 12 dp of the card under the graph, collapsed and open. The collapsed graph card is about 94 dp. Revises D73's height. | Owner: collapsed, the graph rested on the very bottom of the card; open, it was too close to the title. 12 dp is the details' own gap between items. |
| D78 *(owner, 2026-11-07, second look at the card)* | The plot spans the profile's own range again, as on master: the lowest point on the bottom edge, 6 dp headroom over the highest. The labels are the round numbers inside that range, up to three, at the finest round step that gives no more; never a label past the plotted range. A profile flatter than 10 m is drawn over 10 m around its middle, and its labels are the round numbers inside that range, so one may lie past the profile. Revises D55's "three labels, low / middle / high". | Owner: "the graph only occupies the top 2/3 of the space, the bottom 1/3 is just color bands": the axis widened the plot down to a round label under the lowest point (1000 m under a 1150 m low) and kept an 8 dp inset. |
| D79 *(owner, 2026-11-07, second look at the card)* | Each band's fill fades down its area to nothing at the plot's floor, master's floating fade (full at the top edge, 45% at 0.6, 0 at the floor); the flat fill at 0.7 goes. Revises D64's fill. | Owner: "like it used to when it was in floating mode". |
| D80 *(owner, 2026-11-07, second look at the card)* | The y-axis's labels are drawn inside the plot, at its left edge just above their gridlines, behind the bands and the line (they may hide them in places), plain text with no rim (owner: a rim stood out too much); no gutter, the plot takes the card's whole content width. Revises D55's left gutter. | Owner: the graph can then expand over the full width. |
| D81 *(owner, 2026-11-09, after a hike)* | *Revised the same day by D84–D85 (the ahead line's form and the climb rule) and D95 (the card's order).* Recording along a trail, the open card shows, under the Along row, the ahead line (the distance left to the trail's end and the next climb, or the climb in progress: distance to it, gain, length; climbs under 20 m ignored; "Not on the trail" with no puck), then the trail's difficulty badge, metrics and description. Not in the pill. Revises D25 ("Along row, nav row"). | Owner: the trail's specs and description were visible nowhere while recording; wants the km left and when the next climb is. |
| D82 *(owner, 2026-11-09, after a hike)* | `MetricsGrid` lays its tiles out three to a row, in equal columns, wrapping; the activity card's five read Distance · Duration · Average pace, then Elevation gain · Elevation loss. | Owner: on the activity card the values were too close and the labels stuck together (five tiles in one row with no gap). |
| D83 *(owner, 2026-11-09, after a hike)* | *Narrowed 2026-11-11 by D102 (the route's markers stay above the track).* The recorded track is always drawn above the shown route, whatever order they appear in. The stacking is declared on the map port (a tier per route overlay) and enforced by the adapter, not left to the order the overlays mount in. Restores the invariant of the 2026-08-26 follow-trail spec. | Owner's screenshot (2026-11-08 17:25): after relaunching mid-recording the track lay under the trail; the trail loads after the resumed recording and the map stacks a layer on top as it is added. |
| D84 *(owner, 2026-11-09, grilling after the hike)* | The ahead line becomes two lines, one fact each behind an icon: the distance and walking time left; the next climb (distance, walking time, height) or the climb in progress (height left, walking time to the top). Times in "min"/"h", heights always in m. Revises D81's line. Detail: [[2026-11-09-walking-time-ahead-design]]. | Owner: "Too much data, hard to understand what's going on"; the line was clustered and not discoverable. |
| D85 *(owner, 2026-11-09)* | *Revised the same day by D89 (the end of a climb, its average grade, segments).* A climb is found on its own rule over a fixed 50 m smoothing, not on the graph's bands: from a low point to its top, never 10 m below its running high, never 300 m at a flat grade, at least 20 m of gain. Revises D81's "run of touching climbing bands". | Owner: a short flat inside a climb must not split it; the bands also followed the display smoothing preference. |
| D86 *(owner, 2026-11-09)* | Walking time is Tobler's hiking function over the trail's profile, scaled by the personal factor, breaks excluded. | Terrain-aware and personal; the current pace alone is blind to slope. |
| D87 *(owner, 2026-11-09)* | *Wording made exact the same day by D90.* The personal factor starts as the median of the qualifying hikes among the 5 most recent of 2 km or more (derived from their saved tracks, nothing stored) and blends to the hike's own factor over its first 2 km, clamped to 0.5–2; shown nowhere. | Owner: a factor per past hike predicts the next one; it also feeds the trail's time later (T-31). |
| D88 *(owner, 2026-11-09)* | Every duration in the app reads "45 s", "2 min 05 s", "10 min", "1 h 02": "min" and "h", never a bare "m". The stopwatch is unchanged. | Owner: "30m" reads as metres. |
| D89 *(owner, 2026-11-09, review of D84–D88)* | *Revised the same day by D93 (climbs from steep stretches).* A climb starts on the first step rising at 4 % or more and ends at its top, the last high before it falls more than 10 m or goes 300 m without a new high. It counts with at least 20 m of gain at an average of at least 4 % from foot to top, so a long gentle rise stays out. Nothing spans a gap between segments. Revises D85's "never 300 m at a flat grade". | The grilling's rule was "300 m without a new high"; a 300 m window under 4 % also split a moderate climb at a 150 m flat. |
| D90 *(owner, 2026-11-09, review of D84–D88)* | The history factor is the median over those of the 5 most recent saved activities of 2 km or more whose tracks hold at least 2 km of moving steps with elevation; 1 when none does. Kept as built; D87's wording follows it. | Picking by summary first keeps the read to five tracks; a hike that fails the track test is left out, not replaced. |
| D91 *(owner, 2026-11-09, review of D84–D88)* | With no distance left, the end line reads "0 m left", with no time. Every other walking time keeps the 1 min floor. | "0 m · 1 min left" contradicts itself. |
| D92 *(owner, 2026-11-09, review of D84–D88)* | The history factor is held by the recording store as session state, never persisted, and read on start, resume and relaunch by the recording controller; a failed read gives 1 and a `warn` line. The card blends it with the recorded track in a small hook; its props are unchanged. Revises the walking-time spec's "recording hook". | The card's hook read the history whenever the card mounted, away from the paths that begin a segment; the store already holds the recording's session state. |
| D93 *(owner, 2026-11-09, final review)* | A climb is made of climbing stretches (steps at 4 % or more), joined across ground under 300 m that never falls more than 10 m below the climb's top so far, while the joined climb still averages 4 %; foot at its first stretch's start, top at its last stretch's end; at least 20 m. Revises D89. Detail: [[2026-11-09-walking-time-ahead-design]]. | Final review: under D89 a real climb followed by a long gentle rise vanished, and a rejected candidate hid the climbs inside it. |
| D94 *(owner, 2026-11-09, after the device check)* | The next-climb line reads "Next climb in 12 min (1.2 km) · 340 m up". Detail: [[2026-11-09-walking-time-ahead-design]]. | Owner: in "in 208 m · 2 min · 40 m up" it was unclear whether 2 min was the time to the climb or the climb's length. |
| D95 *(owner, 2026-11-09, after the device check)* | The recording card along a trail reads: the Along row; the trail's summary row as the Trails list shows it (difficulty badge, "2.0 km · 56 m gain"); the ahead lines in the primary text, a step larger; the description. No metrics grid on this card. Revises D81's order. | Owner: "Easy" sat "in the middle of nowhere" and the card was not well organised: the trail's total distance sat under the distance left with nothing to tell them apart, and the live lines were the faintest text. |
| D96 *(owner, 2026-11-09, after the device check)* | The graph puck's centre is always exactly on the line, on both axes: it is drawn over the plot, not clipped to it, so at an edge it reaches into the card's margin and stays whole. Revises T-51's clamp inside the plot. | Owner: at the profile's lowest point the puck floated above the line; the card has the margin for a whole puck. |
| D97 *(owner, 2026-11-09, after the device check of D95)* | An entity's badge leads its first summary line, on the same line: "Easy · 2.0 km · 56 m gain", in the Trails list, the Activities list and the recording card alike. Revises the badge over the lines. | Owner expected "Easy" and the length and gain on one line; stacked, they read as separate facts. |
| D98 *(owner, 2026-11-09, after the device check of D95)* | On the recording card the description sits behind a thin divider, in the secondary text at 13 sp. The trail card keeps its description as before. | Owner: the description sat too close to the climbing line and looked like it, though it is different information. |
| D99 *(owner, 2026-11-09, after the device check of D95)* | The climbing line reads "Climbing · 10 min to the top (230 m up)", and the next-climb line "Next climb in 12 min (1.2 km) · 340 m to climb". Revises D94's height. | Owner: in "Climbing · 20 m up" it was unclear whether the 20 m were climbed or still to go; stacked over the climbing line, "to climb" says the next climb's height is its whole. |
| D100 *(owner, 2026-11-09, after the device check of D95)* | The end line reads "Trail end in 3 h 10 (12.4 km)", and "At the trail end" with no distance left. Revises D84's "12.4 km · 3 h 10 left" and D91's "0 m left". | Owner: only the flag said the line was about the trail's end, and under it the climb lines made it unclear; naming the target, time first, distance in brackets, reads like the climb lines. |
| D101 *(owner, 2026-11-09, after the device check of D97)* | On the recording card the trail's summary row sits tight under the "Along {name}" title, and ✕ beside the two, centred on them. Revises D95's ✕ beside the title alone. | Owner: the summary sat as far from the title as from the lines below it, so it was unclear what it referred to. |
| D102 *(owner, 2026-11-11, after the device check of the draped route overlay)* | The recorded track covers the shown route's line, casing and connectors; the route's markers, its direction arrows and endpoint dots, stay drawn above the track. Inside a tier the order stays declared: casing, line, connectors, arrows, endpoints, the lines then the markers, the order Mapbox draws them in with terrain on. Narrows D83 to the route's lines. | With terrain on, Mapbox draws symbol and circle layers above every line, so covering the markers took drawing them as terrain-draped lines (plan `2026-11-10-draped-route-overlay`, items 02–03); on the device those arrows and dots came out blurry, and the arrows misshapen when zoomed out. Owner: markers above the track are no problem, and the dots keep marking the start and end once walked over. |

**Rejected alternatives**

- *Record button centred in the collapsed sheet* (first proposal for D19): rejected by the owner,
  too much visual weight and map cover.
- *Off-trail warning in the pill*: rejected by the owner (D14).
- *A dynamic, content-sized sheet* (first draft of D22): a content change re-snaps an open sheet.
- *The graph only in the sheet, the placement setting removed* (D27 after the challenge):
  superseded by D51 after the device look. The challenge had rejected the setting because master's
  In sheet hid the graph while walking; In sheet now shows it as the collapsed sheet's header.
- *A handle-only sheet when nothing is shown* (D30, D48): hard to grab on the device; replaced by
  the fixed nav bar (D58).
- *Idle graph puck from a new foreground position feed* (first D13 scope): a new port member and an
  idle location subscription for a dot that cannot be right on an out-and-back.
- *Strict 1 km window with `—` until 1 km* (first D6 reading): blank main figure for 15 minutes,
  and an unpaused stop dragged it for a km.
- *Delete disabled while the trail is used* (first D39): more machinery than the owner's "very
  unlikely" case needs.
- *Banner rendered per screen through `ScreenHeader` and `ListScreen`*: misses Settings and the
  loading states.
- *A handle pip drawn on the floating graph, the strip removed* (owner, 2026-11-07, the cheapest fix
  for the empty strip): less discoverable, and it keeps two graph styles.
- *The nav row always visible in the bottom strip* (owner, 2026-11-07): about 56 dp of map lost
  while hiking (D70).
- *No sheet while hiking, details on demand from the pill* (owner, 2026-11-07): a swipe up does
  nothing.
- *A one-line summary in the strip* (owner, 2026-11-07): duplicates the pill.
- *Two windows, a graph card and a separate details card* (owner, 2026-11-07): the second has to
  land somewhere and breaks the drag's continuity (D62).
- *A card translucent at every height* (owner, 2026-11-07): text over the map is hard to read; the
  open card, which holds the details' text, is opaque (D65, D72).
- *The control buttons' elevation shadow on the translucent card* (designer, 2026-11-07): it shows
  through the surface as a dark smear; the pill's `boxShadow` is drawn outside the shape only (D72).
- *The bottom margin above the system's gesture inset* (first D66): twice the side margins on the
  owner's phone (D74).

## 9. Open questions

None. The three left after the challenge were handed to the designer by the owner (2026-11-06) and
are settled as D48–D50. The owner's device look (2026-11-07) is settled as D51–D60, the sizes after
a walk with the build as D61, and the owner's second look the same day (the sheet as a floating
card, round 3) as D62–D71, and the owner's first look at the card (round 4: pip, margins and
translucency) as D72–D74, and the second look at the card (status bar, opacity, graph gap, y range, fade, in-plot
labels) as D75–D80. B2 was a bug with no design question: §4.1 states the framing it must
give.

## 10. Findings → design

Findings F1–F32 are the audit's (2026-11-06), checked against the device screenshots. C1–C9 are the
pre-implementation challenge's, checked in the code. B1–B2 are bugs of the build found in the
owner's device look (2026-11-07), screenshots in `.scratch/device-checks/2026-11-07-hiking-ux-feedback/`.

| # | Finding (evidence) | Answer |
|---|---|---|
| F1 | Tab bar always on screen; no recording sign outside the Map (`app/(tabs)/_layout.tsx:8-47`, `13-trails-tab-while-recording.png`) | §3, §4.6 |
| F2 | No current pace; only the whole-recording average (`RecordingInfoSheet.tsx:48-51`) | §4.2 |
| F3 | Live figures are in the bottom sheet, under or behind the graph | §4.2 |
| F4 | "Paused" shown twice; nothing at the top while recording (`MapScreen.tsx:113-133`) | §4.2 |
| F5 | Hold-to-pause on a 36 dp button with no visible "hold" | §4.3 |
| F6 | "Following" names both the trail and the camera; ✕ silently unlinks the trail | §4.5, §5 |
| F7 | The recording's trail changes silently from the Trails tab (`trails.tsx:62-68`) | §4.7 |
| F8 | No you-are-here on the graph (T-23) | §4.4 (while recording) |
| F9 | "Frame the whole route" frames the trail, not the live track; absent without a trail | Left: controls unchanged (D15); not raised by the owner. |
| F10 | Record button hidden in activity view (`MapScreen.tsx:102`) | §4.1, D49 |
| F11 | Center button cycles silently, same label in every state | Left: controls unchanged (D15). Ticket later. |
| F12 | Hidden gestures on Layers and 2D/3D; current layer not marked | Left: controls unchanged (D15); current-layer mark is a ticket later (D36). |
| F13 | Trail actions split between list and sheet | §4.5 |
| F14 | Offline map removable in three places, downloadable in one | §4.5, §4.13 (removal paths kept; download stays with the trail) |
| F15 | No feedback when a download ends or fails | §4.5 |
| F16 | No feedback after import, save, edit, delete | §4.5, §4.9, §4.11 |
| F17 | Activity delete failure silent (`activities.tsx:50-52`) | §4.5 |
| F18 | Two duration formats; "Elev. Gain" vs "Elevation Gain" | §5 (gain/loss); duration formats left: live clock vs saved summary are different uses. |
| F19 | No live elevation loss | §4.2: kept out of the pill by choice. |
| F20 | "Activity" vs "recording" in the discard alert; "trail" vs "route" | Left: distinct meanings (a recording becomes an activity on save). |
| F21 | Easy/Hard in two scales | §5: left, two concepts. |
| F22 | Location permission denied at launch never told; no offline indicator | Ticket later (D36). Offline is an invariant (ADR 0002). |
| F23 | Save screen has no "back to recording"; Play with a durable session skips trail linking | Failure modes (back returns paused). The linking difference is a ticket later. |
| F24 | Lists flash their empty text while loading | Ticket later (D36). |
| F25 | "Trail actions" menu holds almost no trail actions | §4.5 |
| F26 | A selection that can no longer load is cleared silently | Failure modes |
| F27 | Overlays add `insets.bottom` though the tab bar consumed it | Gone with the tab bar; the collapsed sheet owns `insets.bottom`. |
| F28 | Expanded sheets mostly empty and cover the puck (`05-trail-on-map-expanded.png`, `15-recording-2min-expanded.png`) | §4.5 (measured height) |
| F29 | Status bar unreadable over the map (`01-map-idle.png`) | Left: the owner prefers the status icons straight on the map (D57). |
| F30 | Small targets: ⋮, chip ✕, offline trash | §4.2, §4.5 (44 dp); offline trash ticket later |
| F31 | Save button disabled with no reason (`18-save-form.png`) | §4.11 |
| F32 | Debug-log filter chips' on/off unreadable (`22-debug-log.png`) | Ticket later (D36). |
| C1 | A 28 dp handle on the gesture bar is the only way to the nav; the graph's vertical drags pan the map; no tap-to-open; "In sheet" hides the graph while walking | §4.4, §4.5, D27, D51, D52 |
| C2 | A content-sized sheet re-snaps on content changes and pushes overlays under the pill (`MapInfoSheet.tsx:28-29`) | §4.5, D43 |
| C3 | Moving time is wall time minus pauses (`session.ts:4`), so an unpaused stop drags a rolling window; gap rule ambiguous | §4.2, D41 |
| C4 | `router.navigate('/')` from a stack screen pushes a second Map (`save.tsx:13-14`) | §3, §6, D45 |
| C5 | The banner cannot be rendered by `ScreenHeader` / `ListScreen` | §4.6, §6, D47 |
| C6 | No position reaches JS outside recording (`src/location/index.ts`; the map puck is native) | §4.4, D42 |
| C7 | Import and the offline-maps tap changed the recording's trail silently | §4.7, D46 |
| C8 | `ActionsMenu` only opens upward; `showToast` neither queues nor merges | §4.5, D40 |
| C9 | Paused health hides location state (`streamHealth.ts:19`); fixed camera padding `top: 100` (`tokens.ts:25`) | §4.2, §4.1, D44 |
| B1 | Open is derived from gorhom's `onAnimate` / `onChange`, which do not fire when a drag over-pulls past the open snap point (`handleComponent={null}`, `MapInfoSheet.tsx:123`): the sheet shows open while counted collapsed, so the nav row ignores taps (`pointerEvents`, `MapInfoSheet.tsx:94`), the handle says "Show more", back leaves the app (`09-idle-open-by-drag-desynced.png`, `10-settings-tap-ignored.png`, `24-trail-open-by-drag.png` vs `25-trail-open-partial-drag.png`) | §4.5, §6 "State", `T-60` |
| B2 | A 1.3–2 km track is framed at city scale on show and on "Frame the whole route" (`22-activity-frame-route.png`, `23-after-trail-save.png`); cause: Mapbox's bounds fit insets the box within the camera's current padding on top of the given one, and following leaves its padding on the camera, so the box got the overlays' room twice (zoom 10.7 where 13.95 fills the band) | §4.1 "Camera padding"; the fit sized from the box, the view and the padding alone (`fitCameraFor`) |
