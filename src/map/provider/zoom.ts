// A zoom is the Web Mercator zoom of the GL map engines: the world is 512 dp wide at zoom 0 and twice
// as wide at each zoom up.
export const WORLD_DP_AT_ZOOM_0 = 512

const EARTH_CIRCUMFERENCE_METERS = 40075016.686

// The ground length of one dp at a latitude and a zoom.
export function metersPerDp(lat: number, zoom: number): number {
  return (EARTH_CIRCUMFERENCE_METERS * Math.cos((lat * Math.PI) / 180)) / (WORLD_DP_AT_ZOOM_0 * 2 ** zoom)
}
