export const OFFLINE_MIN_ZOOM = 10
export const OFFLINE_MAX_ZOOM = 16
export const OFFLINE_MARGIN_KM = 2

// Heuristic average compressed bytes per tile. Vector tiles are small; raster
// (satellite) imagery tiles are much larger. Used only for pre-download estimates.
export const VECTOR_BYTES_PER_TILE = 25_000
export const RASTER_BYTES_PER_TILE = 90_000
