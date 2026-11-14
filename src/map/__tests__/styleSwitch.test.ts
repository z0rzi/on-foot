import { resolveQuickSwitch } from '../styleSwitch'

// Mirrors the provider's style list shape (id + semantic satellite flag), never a hardcoded
// provider style id, preserving the seam.
const STYLES = [
  { id: 'standard' },
  { id: 'satellite', satellite: true },
  { id: 'outdoors' },
]

describe('resolveQuickSwitch', () => {
  test('valid, different, in-list previous wins', () =>
    expect(resolveQuickSwitch('standard', 'outdoors', STYLES)).toBe('outdoors'))
  test('previous equal to current falls through to the satellite toggle', () =>
    expect(resolveQuickSwitch('satellite', 'satellite', STYLES)).toBe('standard'))
  test('previous absent from the list falls through to the satellite toggle', () =>
    expect(resolveQuickSwitch('standard', 'ghost', STYLES)).toBe('satellite'))
})

describe('resolveQuickSwitch without a previous style: the satellite toggle', () => {
  test('non-satellite layer -> satellite', () =>
    expect(resolveQuickSwitch('standard', null, STYLES)).toBe('satellite'))
  test('another non-satellite layer -> satellite', () =>
    expect(resolveQuickSwitch('outdoors', null, STYLES)).toBe('satellite'))
  test('satellite -> first non-satellite in the list', () =>
    expect(resolveQuickSwitch('satellite', null, STYLES)).toBe('standard'))
  test('no satellite in list -> falls back to current id', () =>
    expect(resolveQuickSwitch('standard', null, [{ id: 'standard' }])).toBe('standard'))
  test('only-satellite list -> falls back to current id', () =>
    expect(resolveQuickSwitch('satellite', null, [{ id: 'satellite', satellite: true }])).toBe('satellite'))
})
