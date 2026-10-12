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

### Offline

**Offline map**:
Everything downloaded for one trail so its map can be shown without a network: one pack per layer
the user chose. Removed as a whole.
_Avoid_: offline region, download (as a noun)

**Pack**:
The provider's unit of offline download — the tiles for one trail on one layer. Named
`offline:<trailId>:<layerId>`; the provider owns the bytes and is the only source of what exists.
_Avoid_: region, cache, tile set
