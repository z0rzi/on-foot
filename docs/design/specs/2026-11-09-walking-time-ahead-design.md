# Walking time ahead: distance, time and climbs left on the recording card — Design

**Status:** Built, tickets T-79–T-82, T-90 and T-94, all closed. From the owner's grilling of
2026-11-09 (after the hike of 2026-11-08). Revises the ahead line of the hiking-ux spec (D81) as its
D84–D88. Revised the same day by the
owner's rulings on the code review, D89–D92, on the final review, D93, and on the device checks, D94, D99 and D100.
**From:** [[2026-11-06-hiking-ux-design]] (D81, §4.5 "Recording / paused"); T-31 (the trail card's
estimated time, an idea that will reuse the estimator).
**Date:** 2026-11-09

Terms are the glossary's: **Climb**, **Walking time**, **Personal factor**, **Segment**, **Point**,
**Card**. User story 25 and D88 widen the time-format rule to every duration in the app.

## Problem Statement

Recording along a trail, the open card's ahead line packs the distance left, the next climb's
distance, gain and length onto one line: "12.4 km left · Next climb in 1.2 km, 340 m up over
2.8 km". On the hike the owner could not take it in at a glance: too many figures, run together, and
none of them answers the question a walker actually asks, "how long?". The climb rule also splits a
climb at any stretch of flat or a small dip longer than the display smoothing, and it moves when the
owner changes the graph's smoothing preference, which is meant only to make the colour bands
readable.

## Solution

The ahead line becomes two lines, one fact each, each behind an icon:

- 🏁 **Trail end in 3 h 10 (12.4 km)** *(D100)*: the walking time to the trail's end and the distance
  to it; at the end, **At the trail end** (D91, D100).
- ⛰ one of:
  - **Next climb in 12 min (1.2 km) · 340 m to climb** *(D94, D99)*: the walking time and distance to
    the next climb's foot, and the climb's whole height.
  - **Climbing · 10 min to the top (230 m up)** *(D99)*: on a climb, the walking time to its top and
    the height left.
  - **No climb left**.

Off the trail, a single line reads **Not on the trail**. A trail with no elevation profile shows
neither line, as today.

Walking time is the standard hiking formula's time over the trail's profile, scaled by the walker's
personal factor. The personal factor starts from the owner's recent hikes and moves smoothly to the
one measured on the hike in progress over its first 2 km. A climb is found on its own rule, a fixed
one that ignores the graph's bands and the smoothing preference: a short flat or dip inside a climb
does not end it, and a long gentle rise is not one.

## User Stories

1. As a hiker recording along a trail, I want to see how far it is to the trail's end, so that I know
   how much of the walk is left.
2. As a hiker recording along a trail, I want to see how long the rest of the trail will take me, so
   that I can tell whether I will finish before dark.
3. As a hiker, I want that time to account for the climbs and descents still ahead, so that 3 km of
   ascent is not estimated like 3 km of flat.
4. As a hiker, I want that time to match my own walking speed, so that a fast or slow walker both get
   a time they can trust.
5. As a hiker starting a hike, I want the time to be sensible from the first metre, from how I walked
   on my recent hikes, so that the card is useful before I have walked far.
6. As a hiker, I want the time to adapt to how I am walking today, so that a tired day or a fresh day
   is reflected after a while.
7. As a hiker, I want that adaptation to be gradual, so that the times never jump when the estimate
   switches from my history to today's walk.
8. As a hiker who stops for lunch, I want breaks left out of the estimate, so that a long stop does
   not make me look slow for the rest of the day.
9. As a hiker, I want to see when the next climb starts, in distance and in time, so that I can
   decide to drink, eat or rest before it.
10. As a hiker, I want to see how high the next climb goes, so that I know how hard it will be.
11. As a hiker on a climb, I want to see the height left to its top and the time to get there, so that
    I can pace myself to the top.
12. As a hiker, I want a short flat or a small dip in the middle of a climb not to end it, so that the
    card does not announce "next climb in 80 m" halfway up a hill.
13. As a hiker, I want a long flat stretch or a real descent to end a climb, so that two separate
    hills are shown as two climbs.
14. As a hiker, I want small bumps under 20 m ignored, so that the card only speaks of climbs worth
    knowing about.
15. As a hiker, I want a long gentle rise not to be announced as a climb, so that "Climbing" means
    climbing.
16. As a hiker past the trail's last climb, I want to read "No climb left", so that I know the rest is
    flat or downhill.
17. As a hiker who has left the trail, I want to read "Not on the trail", so that I do not trust
    figures about a trail I am no longer on.
18. As a hiker, I want each figure on its own line behind an icon, so that I find the one I want at a
    glance.
19. As a hiker, I want times written "12 min" or "1 h 20", never "20m", so that a time is never read
    as a distance.
20. As a hiker, I want heights always in metres, so that "340 m up" is never "0.3 km up".
21. As the owner, I want the climbs to stay the same whatever the graph's smoothing preference, so
    that changing how the graph looks does not change what the card says.
22. As the owner, I want no new data stored for the personal factor, so that the estimate can be
    improved later and every past hike is re-read the new way.
23. As a hiker whose history cannot be read, I want the card still to show times, so that one failure
    does not blank the card.
24. As the owner, I want the estimator built on the trail's profile, so that the trail card can later
    give the trail's walking time (T-31).
25. As a hiker reading an activity, I want its duration written "1 h 02" or "12 min", so that every
    time in the app reads the same way and none reads as metres.

## Implementation Decisions

- **D84, the two lines.** The ahead line becomes the two lines of the Solution, between the Along
  row and the difficulty badge, in `onSurfaceVariant`. Icons are Material Community icons, decorative
  (the text carries the meaning): `flag-checkered` for the trail's end, `image-filter-hdr` for the
  climb line, `map-marker-off` for "Not on the trail". Separator "·" throughout. The lines follow the
  graph's puck, so they move with it and are up to about 15 s behind; no timer of their own.
- **D85, the climb** *(revised by D89, then by D93)*. Found on the trail's profile smoothed over a
  fixed 50 m, its own constant, never the display smoothing preference.
- **D93, climbs from steep stretches** *(owner, 2026-11-09, final review)*. A **climbing stretch** is a
  run of steps each rising at the flat band's bound (4 %) or more. A climb is one climbing stretch, or
  several joined: the next stretch joins the climb when the ground between them is shorter than
  **300 m**, never falls more than **10 m** below the climb's top so far, and the climb from its foot
  to the end of that stretch still averages **4 %** or more. Its foot is the start of its first
  stretch, its top the end of its last; gentle ground after the last stretch never extends it. It
  counts when it gains at least **20 m**. Nothing spans a gap between segments. Its height is the
  profile's rise from foot to top; while on it, the height left is the rise from the walker's place
  to the top. Revises D89, whose "last high before 300 m without a new high" let any slight rise move
  the top forward, so a real climb followed by a long gentle rise failed the 4 % average and vanished,
  and whose scan skipped past a rejected candidate, losing the climbs inside it.
- **D86, walking time.** Tobler's hiking function on the trail's 50 m-smoothed profile, step by step:
  speed (km/h) = 6 · e^(−3.5 · |grade + 0.05|), so the fastest walk is a slight descent, and both
  climbs and steep descents slow it. The walking time over a stretch is the sum of its steps' times,
  multiplied by the personal factor. A step crossing a gap between segments is not walked and has no
  time.
- **D87, the personal factor.** A track's factor is its moving time divided by Tobler's time over
  the same steps. Its own elevation is smoothed with the window stored gain already uses, a step is
  moving by the same rule current pace uses (slower than walking pace is a stop), a step without
  elevation at either end counts in neither time, and segments are never crossed.
  - **History factor** *(wording per D90)*: the 5 most recent saved activities of 2 km or more are
    read; of those, the ones whose tracks hold at least 2 km of moving steps with elevation qualify,
    and the factor is the median of theirs; 1 when none does. Derived from the saved tracks when a
    recording starts, resumes or is relaunched; nothing new is stored.
  - **Live factor:** the same measure over the recording in progress, all of it so far.
  - **Blend:** from history to live over the first 2 km of moving distance on steps with elevation
    (the only steps the live factor can measure):
    factor = (1 − w) · history + w · live, w = min(1, walked / 2 km); the history factor alone while
    the live one has no moving step yet. The result is clamped to 0.5–2.
  - It is shown nowhere (T-31 holds the "faster or slower than usual" idea).
- **The ahead calculation** stays one pure function next to the trail-progress logic, now taking the
  route display, the puck's distance along the profile and the personal factor. It returns the
  distance and walking time left, and the climb: next (distance, walking time, height), climbing
  (height left, walking time to the top) or none. The climb rule and the walk over a profile are
  private to the elevation module; Tobler's speed for one step is exported, as the personal factor
  measures tracks with it, and the walk over a profile is exported once the trail card needs it
  (T-31).
  Its per-profile work, the 50 m smoothing and the climbs, is done once per route display, as the
  route display does its banding once: the display is kept across renders and fix batches, so the
  puck moving recomputes only the place-dependent figures.
- **The personal factor** is pure logic in the recording module, split as D92 requires: which saved
  activities to read, the history factor from their tracks, and the blended factor from the history
  factor and the live tracks. The moving-step rule is extracted from current pace into one shared
  predicate that both use. It reads a track's runs of points carrying elevation, each at its distance
  along the track, through the helper the stored metrics use, and smooths them as stored gain does.
- **Loading the history** *(D92)* is the recording store's: it holds the history factor as session
  state (in memory, never persisted; 1 until the read resolves), and reads it itself whenever it
  takes a session it did not hold or the session's next segment begins (a start, a resume, a
  relaunch that finds a session), so no path that begins a segment can miss it. The read lists the
  activity summaries newest first, keeps those of 2 km or more, and loads the tracks of the first five through
  the existing activities repository (no new repository method), the store being where a data barrel
  is composed. A failed read leaves factor 1 and a `warn` line; a read that resolves after its
  recording ended is dropped. The card blends the store's history factor with the recorded track in
  a small hook, so its props stay the trail, the route display and the puck.
- **The formatter** returns the lines to show, each with its kind (end, climb, off the trail), and
  the card maps a kind to its icon, out of the accessibility tree. Walking time is rounded to the
  minute, never under one, and written by the one duration format (D88), which lives with the other
  shared formats in the units module; with no distance left, the end line gives no time, "At the
  trail end" (D91, D100); distances through the units module (metres under 1 km);
  heights through the units module, always metres.
- **D94, which time** *(owner, 2026-11-09, after the device check)*. The next-climb line reads "Next
  climb in 12 min (1.2 km) · 340 m up": "in" governs the time, the distance in brackets says the same
  place another way, and the height stands apart. "Next climb in 1.2 km · 12 min · 340 m up" left it
  unclear whether 12 min was the time to the climb or the climb's own length. Its height reads "340 m
  to climb" since D99 (hiking-ux spec).
- **D99, which height** *(owner, 2026-11-09, after the device check of D94)*. The climbing line reads
  "Climbing · 10 min to the top (230 m up)": "to the top" governs both the time and the height in
  brackets, so the height is what is left. "Climbing · 230 m up" left it unclear whether the height
  was climbed or still to go.
- **D100, which end** *(owner, 2026-11-09, after the device check of D99)*. The end line reads "Trail
  end in 3 h 10 (12.4 km)", and "At the trail end" with no distance left: it names its target, the
  time first and the distance in brackets, like the climb lines. "12.4 km · 3 h 10 left" left only
  the flag to say what was left, and under it the climb lines blurred it. Revises D91's "0 m left".
- **D88, durations everywhere** *(owner, 2026-11-09)*. The app's one duration format writes "45 s",
  "2 min 05 s", "10 min", "1 h 02": "min" and "h", never a bare "m" or a glued "1h 2m". Seconds show
  only under an hour and only when not zero, as today. It serves the activity card, the save
  screen, the activity summary line and walking time; the stopwatch format ("1:02:00") is a clock,
  not a duration, and is unchanged.

## Testing Decisions

- A good test drives a pure function through its public input and checks its visible result (a
  climb's place and height, a time, a factor, a line of text), never the steps inside. Profiles and
  tracks are built synthetically in the tests; no real coordinates.
- **The ahead calculation**, red first. Climb cases: a 10 m flat and a 5 m dip inside a climb stay one
  climb; a 5 % climb stays one across 150 m of flat; 400 m of flat splits it; a 30 m drop splits it;
  a steep climb followed by a long gentle rise is still found, its top where the steep part ends
  (D93); a lone steep step far before a steep climb neither hides the climb nor moves its foot (D93);
  a 15 m rise is skipped; a 2 km rise at 1 % is not a climb, nor is a rise of steep steps averaging
  under 4 %; a gentle approach before a steep climb does not move the climb's foot earlier; no climb
  spans a gap between segments; before a climb, on one, past the last, at the end, the puck past the
  end; an empty and a one-point profile give no climb and zero time; the result is the same for any
  smoothing preference. Time cases: a flat profile takes Tobler's flat time; a climb takes longer
  than the same distance flat; factor 2 doubles every time; no time across a gap between segments.
- **The personal factor**, red first: a track walked exactly at Tobler's speed gives 1; stops are
  left out; steps without elevation are left out; the median of five; fewer than 2 km leaves an
  activity out; no history gives 1; the blend at 0, 1 and 2 km and beyond; the clamp at both ends.
  The store: the factor read from the saved activities, 1 and a `warn` line on a failed read, 1
  again once the recording ends, a late read dropped. The controller: the factor read on start, on
  resume and on a relaunch, not for a session the process already holds.
- **The formatter**: each wording of the Solution; "12 min", "1 h 05", "1 min" as the floor; "At the
  trail end" with no time at the end (D100); a height of 1 200 m reads "1200 m", never km.
- **The duration format**, red first: its existing tests rewritten to D88's wording ("45 s",
  "2 min 05 s", "10 min", "1 h 02", "0 s" for a negative).
- Prior art: the trail-progress tests and the existing ahead tests in the elevation module (synthetic
  profiles), the current-pace tests in the recording module (synthetic tracks with timestamps), the
  trail format tests.
- The card, its icons and the lines following the puck are device-verified, with a mocked GPS replay
  along a test trail, never the owner's position.

## Existing shape

- **The ahead line** is the first instance and is revised in place: its calculation, its formatter
  and its slot on the recording card stay, nothing is forked.
- **Moving steps**: current pace is the first instance of "which steps of a track are walking". The
  personal factor is the second, so the rule is extracted into one predicate both use, not copied.
- **Elevation smoothing**: stored gain's fixed window (the elevation filter) is the first instance of
  smoothing that must not follow the display preference; the climb's fixed 50 m and the factor's use
  of the stored window follow it. The stored metrics' runs of points carrying elevation are the
  first instance of that walk over a track; the factor is the second, so the runs are extracted once
  (in the geo metrics) and both read them. The display banding stays the only reader of the preference.
- **Duration formatting**: the activities' duration format is the first instance. Walking time is
  the second, so it is not given its own: the one format changes to "min"/"h" (D88), moves to the
  units module beside the other shared formats, and walking time calls it with a value rounded to
  the minute.
- **Trail time (T-31)**: none yet; the walking-time function and the history factor are written so
  it can reuse them, nothing built for it now.

## Failure modes

| Mode | Visible outcome | Recovery |
|---|---|---|
| No saved activity qualifies (new install, only short walks) | Times from Tobler alone (factor 1), then the live factor takes over over 2 km | Automatic as the hike goes on |
| History read fails (database error) | Times from factor 1; a `warn` line in the debug log (`recording` area, no coordinates) | Next start, resume or relaunch reads it again |
| History still loading after a start, resume or relaunch | Times from factor 1 for those moments, then the history factor | Automatic |
| Recorded points without elevation | Those steps count in neither time; with none, the history factor stays | Automatic once points carry elevation |
| Off the trail, or no point matched yet | One line, "Not on the trail" | Both lines return once back on the trail |
| Trail with no elevation profile | No ahead lines; the rest of the card as normal | — |
| Walking the trail against its direction | Distance, time and climbs count toward the trail's own end | — |
| A long stop | The times stay where they were (no moving step, no change) | They resume with the puck |
| A very fast or slow day, or a GPS glitch | The factor is clamped to 0.5–2, so no absurd time | — |
| Empty or one-point profile or track | The pure functions return no climb, zero time and no factor rather than throw (tested); a render-time throw elsewhere reaches the app's error boundary, as for any card today | Relaunch |

## Out of Scope

- The pill, which keeps its four figures.
- The trail card's walking time and "faster or slower than usual" (T-31).
- Showing the personal factor anywhere.
- Storing a factor per activity.
- Walking the trail against its direction (counted toward the trail's own end, as in D81).
- The stopwatch format of the pill and the banner.

## Further Notes

- Climb, Walking time and Personal factor are glossary terms. D89 keeps the grilling's rule, "300 m
  without a new high", which D85 had first sharpened into "no 300 m stretch rising slower than 4 %".
  That window split a moderate climb at a short flat; the 4 % average from foot to top now does its
  other job, keeping a long gentle rise from counting.
- Tobler's function and its constants are the published ones (Tobler, 1993); the personal factor
  absorbs the difference between that model and the owner's walk, which is why it is clamped rather
  than tuned.
