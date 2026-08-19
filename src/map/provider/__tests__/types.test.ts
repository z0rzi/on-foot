import { isValidCapabilities } from '../types'

test('a well-formed capabilities object validates', () => {
  expect(
    isValidCapabilities({
      id: 'x',
      requiresToken: true,
      supportsTerrain: true,
      supportsDataDrivenLayers: true,
      offline: true,
      styles: [{ id: 's', label: 'S', url: 'u', preview: 0 }],
    })
  ).toBe(true)
})

test('missing styles fails validation', () => {
  expect(isValidCapabilities({ id: 'x', requiresToken: true })).toBe(false)
})
