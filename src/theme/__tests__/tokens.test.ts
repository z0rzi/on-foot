import { MapTokens } from '../tokens'

test('MapTokens carries the ported map behavior constants', () => {
  expect(MapTokens.locationZoom).toBe(15)
  expect(MapTokens.pitchToggle).toBe(60)
  expect(MapTokens.pitchMin).toBe(0)
  expect(MapTokens.pitchMax).toBe(85)
  expect(MapTokens.controlSize).toBe(36)
  expect(MapTokens.terrainTileSize).toBe(514)
  expect(MapTokens.terrainExaggeration).toBe(1.0)
})
