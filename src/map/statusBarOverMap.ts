import type { MapTone } from './provider/types'

// The status bar's icons straight on the map, with no scrim: they follow the layer's tiles, not the
// app's theme, since the outdoors layers stay light in the dark theme.
export function statusBarStyleOverMap(tone: MapTone): 'dark' | 'light' {
  return tone === 'light' ? 'dark' : 'light'
}
