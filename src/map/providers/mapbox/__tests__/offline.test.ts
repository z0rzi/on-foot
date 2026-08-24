import { mapPackState } from '../offline'

describe('mapPackState', () => {
  // Numeric forms (iOS may report the enum ordinal).
  test('state 2 → complete', () => expect(mapPackState(2, 50)).toBe('complete'))
  test('100% → complete regardless of state', () => expect(mapPackState(1, 100)).toBe('complete'))
  test('active + partial → downloading', () => expect(mapPackState(1, 40)).toBe('downloading'))
  test('inactive + partial → incomplete', () => expect(mapPackState(0, 40)).toBe('incomplete'))

  // String forms (Android reports the enum rawValue, incl. the misspelled "unkown").
  test("'complete' → complete", () => expect(mapPackState('complete', 50)).toBe('complete'))
  test("'active' + partial → downloading", () => expect(mapPackState('active', 40)).toBe('downloading'))
  test("'inactive' + partial → incomplete", () => expect(mapPackState('inactive', 40)).toBe('incomplete'))
  test("'unkown' + partial → incomplete", () => expect(mapPackState('unkown', 40)).toBe('incomplete'))
})
