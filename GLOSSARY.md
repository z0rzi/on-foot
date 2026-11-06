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

### Recording

**Fix**:
A position the location service hands over, with its accuracy. Not yet part of the track: it may
be rejected.
_Avoid_: location, sample, coordinate

**Point**:
A fix kept into a recording's track.
_Avoid_: fix (once kept), sample, coordinate

**Segment**:
A continuous run of points, opened by start, resume or a relaunch after the app was killed. Nothing
is measured across two segments.
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
