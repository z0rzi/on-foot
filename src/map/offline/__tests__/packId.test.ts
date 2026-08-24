import { packId, parsePackId } from '../packId'

describe('packId / parsePackId', () => {
  test('builds the canonical name', () => {
    expect(packId(7, 'outdoors')).toBe('offline:7:outdoors')
  })
  test('round-trips', () => {
    expect(parsePackId(packId(42, 'satellite'))).toEqual({ trailId: 42, styleId: 'satellite' })
  })
  test('preserves style ids containing colons/hyphens', () => {
    const id = packId(3, 'mapbox:custom-v2')
    expect(parsePackId(id)).toEqual({ trailId: 3, styleId: 'mapbox:custom-v2' })
  })
  test('returns null for a foreign or malformed name', () => {
    expect(parsePackId('some-other-pack')).toBeNull()
    expect(parsePackId('offline:notanumber:x')).toBeNull()
    expect(parsePackId('offline:5')).toBeNull()
  })
})
