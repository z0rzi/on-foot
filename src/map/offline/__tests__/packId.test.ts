import { packId, parsePackId, packsForTrail } from '../packId'

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

describe('packsForTrail', () => {
  test('keeps the matching packs with their parsed style', () => {
    const items = [
      { id: 'offline:7:outdoors', state: 'complete' },
      { id: 'offline:7:satellite', state: 'error' },
      { id: 'offline:9:outdoors', state: 'complete' },
    ]
    expect(packsForTrail(items, 7)).toEqual([
      { pack: items[0], styleId: 'outdoors' },
      { pack: items[1], styleId: 'satellite' },
    ])
  })

  test('drops ids belonging to another trail', () => {
    expect(packsForTrail([{ id: 'offline:9:outdoors' }], 7)).toEqual([])
  })

  test('drops ids that do not parse', () => {
    expect(packsForTrail([{ id: 'not-a-pack-id' }], 7)).toEqual([])
  })
})
