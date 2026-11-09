import { statusBarStyleOverMap } from '../statusBarOverMap'

describe('the status bar over the map', () => {
  test('over a light layer, whatever the app theme, its icons are dark', () => {
    expect(statusBarStyleOverMap('light')).toBe('dark')
  })
  test('over a dark layer (aerial imagery), its icons are light', () => {
    expect(statusBarStyleOverMap('dark')).toBe('light')
  })
})
