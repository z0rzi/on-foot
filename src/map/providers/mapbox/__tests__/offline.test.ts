import { mapPackState } from '../offline'

describe('mapPackState', () => {
  test('state 2 → complete', () => expect(mapPackState(2, 50)).toBe('complete'))
  test('100% → complete regardless of state', () => expect(mapPackState(1, 100)).toBe('complete'))
  test('active + partial → downloading', () => expect(mapPackState(1, 40)).toBe('downloading'))
  test('inactive + partial → incomplete', () => expect(mapPackState(0, 40)).toBe('incomplete'))
})
