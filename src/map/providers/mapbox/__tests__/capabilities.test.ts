import { MAPBOX_STYLES, mapboxCapabilities } from '../capabilities'
import { isValidCapabilities } from '../../../provider/types'

test('exposes the three ported styles with correct URLs', () => {
  const byId = Object.fromEntries(MAPBOX_STYLES.map((s) => [s.id, s.url]))
  expect(byId.standard).toBe('mapbox://styles/mapbox/standard')
  expect(byId.satellite).toBe('mapbox://styles/mapbox/standard-satellite')
  expect(byId.outdoors).toBe('mapbox://styles/mapbox/outdoors-v12')
})

test('mapbox capabilities are valid and terrain-capable', () => {
  expect(isValidCapabilities(mapboxCapabilities)).toBe(true)
  expect(mapboxCapabilities.supportsTerrain).toBe(true)
})
