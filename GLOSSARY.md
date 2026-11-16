# On Foot

A hiking companion: trails imported from GPX, shown on a map that works without a network, and
activities recorded against them. One context; terms below are the ones the code and the specs
have settled on.

## Language

### Map

**Provider**:
The map SDK the app is built on, behind the map port. Exactly one per build, swappable without
touching code outside its directory.
_Avoid_: engine, backend, Mapbox (as a generic term)

**Layer**:
A visual style of the map the user can switch between — Outdoors, Satellite. Declared by the
provider; the app only knows a layer by its descriptor.
_Avoid_: style (in user-facing text), basemap, theme

**Overview**:
Every saved trail and activity drawn on the map at once, each with a pin at its start. The user
chooses whether it holds trails, activities, both or neither; what is selected or being recorded is
drawn whatever that choice. Chosen in the Layers menu, but not a layer.
_Avoid_: layer (a map style), overlay, heatmap

**Completed**:
Said of a trail with at least one saved activity linked to it, however much of the trail that
activity covered.
_Avoid_: done, finished, hiked

**Family**:
A trail and every saved activity linked to it. Selecting any one of them shows them all.
_Avoid_: group, siblings (as the whole), linked set

**Pin**:
The mark at the start of a trail or activity in the overview: a teardrop whose tip is on the start
point, with a tag beside it that gives the distance. With trails shown, a family has one pin, its
trail's.
_Avoid_: marker, flag, annotation

**Cluster**:
Pins too close to tell apart at the current zoom, merged into one disc with their count.
_Avoid_: group, bubble, stack

**Capability**:
A map feature a provider may lack and the app renders without — today only 3D terrain. Offline is
not one: every provider must support it, so the app never asks.
_Avoid_: feature flag, support flag, option

**Follow**:
The camera is locked on the user's position — position alone, or position and heading. Any manual
pan, zoom or tilt ends it.
_Avoid_: tracking, locked camera, recenter mode

**Free camera**:
The camera is not following: its framing is the one the user set by hand.
_Avoid_: manual camera, unlocked, follow off (in user-facing text)

**Last camera**:
The camera's framing — centre, zoom, pitch, heading — as it last came to rest, following or free. A launch starts the map on it.
_Avoid_: saved position, last view, camera state

**Offline map**:
Everything downloaded for one trail so its map can be shown without a network: one pack per layer
the user chose. Removed as a whole.
_Avoid_: offline region, download (as a noun)

**Pack**:
The provider's unit of offline download — the tiles for one trail on one layer. Named
`offline:<trailId>:<layerId>`; the provider owns the bytes and is the only source of what exists.
_Avoid_: region, cache, tile set

**Card**:
The floating panel at the bottom of the map, with a margin from the screen edges. The *graph card*
when a trail, activity or recording is shown: it holds the elevation graph and is pulled up for the
details and the nav row. The *nav card* when nothing is shown and the user is idle: it holds the
nav row only and does not move.
_Avoid_: sheet, bottom sheet, panel, drawer

**Pill**:
The status strip at the top of the map naming what is shown, with its figures and its close
button.
_Avoid_: banner, header chip, title bar

**Nav row**:
The three entries to the rest of the app — Trails, Activities, Settings.
_Avoid_: tab bar, bottom nav, toolbar

### Recording

**Fix**:
A position the location service hands over, with its accuracy. Not yet part of the track: it may
be rejected.
_Avoid_: location, sample, coordinate

**Point**:
A fix kept into a recording's track.
_Avoid_: fix (once kept), sample, coordinate

**Segment**:
A continuous run of points, opened by start, resume, or a relaunch after the app was killed that
finds a real gap (more than 30 s since the session was last known recording); a relaunch with
nothing missing goes on in the current one. Nothing is measured across two segments.
_Avoid_: leg, section, part

**Anchor**:
The point a new fix is judged against: the last point of the current segment. A segment's first fix
has none.
_Avoid_: previous point, last fix, reference

**Candidate**:
A rejected fix good enough to testify against the anchor: if the next good fix agrees with it rather
than with the anchor, the anchor was the error and the track moves on.
_Avoid_: pending fix, suspect

**Jump**:
A fix farther from the previous point of its segment than a walker could have gone in the time
elapsed.
_Avoid_: spike, glitch, teleport

### Elevation

**Climb**:
A stretch of trail rising at least 20 m at an average of at least 4 %, made of steep stretches (4 %
or more) joined across short flats or dips: under 300 m, never more than 10 m below its top so far.
It runs from the foot of its first steep stretch to the top of its last; a long gentle rise is not
one and never extends one.
_Avoid_: ascent, uphill (a slope band), hill

**Walking time**:
The estimated moving time over a stretch of trail, breaks excluded.
_Avoid_: ETA, duration, time left

**Personal factor**:
How much slower or faster than the standard hiking formula someone walks: from their recent saved
activities at the start of a recording, then from the recording in progress.
_Avoid_: pace (minutes per km), speed, fitness

### Work

**Ticket**:
One open unit of internal work, in the worklist. It exists while the work is open and is deleted
when the work lands or is ruled out.
_Avoid_: issue (reserved for outside reports), task, item, finding (once filed)

**Area**:
The product surface a ticket belongs to — map, recording, trails, activities, elevation, offline,
settings, app shell. Exactly one per ticket.
_Avoid_: project, module, component, domain

**Idea**:
A ticket that is a parked wish, not committed work: it may be promoted into work, dropped, or sit.
Nobody is waiting on it.
_Avoid_: feature request, backlog item, todo, wish

**Work item**:
One slice of a plan, built by one worker and gone when it lands. It belongs to its plan, not to
the worklist, and has no number of its own beyond its place in the plan.
_Avoid_: ticket (for a plan's slice), task, sub-issue, step

**Device check**:
A run of the app on the owner's phone, driven by an agent, that confirms a claim with what the
phone shows.
_Avoid_: device test, manual test, QA

**Check hook**:
A command a device check sends the app to set up, tear down or read its state without the screen.
Only a build made for device checks has hooks, and only the phone's debug connection can call
them.
_Avoid_: debug bridge (that is adb), backdoor, test API, intent (the transport, not the concept)
