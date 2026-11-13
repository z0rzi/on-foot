import { MAPBOX_STYLES, mapboxCapabilities } from '../capabilities'

test('exposes the three ported styles with correct URLs', () => {
  const byId = Object.fromEntries(MAPBOX_STYLES.map((s) => [s.id, s.url]))
  expect(byId.standard).toBe('mapbox://styles/mapbox/standard')
  expect(byId.satellite).toBe('mapbox://styles/mapbox/standard-satellite')
  expect(byId.outdoors).toBe('mapbox://styles/mapbox/outdoors-v12')
})

test('mapbox capabilities are terrain-capable', () => {
  expect(mapboxCapabilities.supportsTerrain).toBe(true)
})

test('mapbox camera zooms from 0 (whole earth) to 25', () => {
  expect([mapboxCapabilities.minZoom, mapboxCapabilities.maxZoom]).toEqual([0, 25])
})

// The stack that rendered Latin, Greek, Georgian and ✓ offline on all three layers (spec D133).
test('every layer declares its own labels’ font stack, for text the map draws offline', () => {
  for (const style of MAPBOX_STYLES) expect(style.labelFont).toEqual(['DIN Pro Medium', 'Arial Unicode MS Regular'])
})
