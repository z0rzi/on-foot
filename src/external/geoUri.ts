import type { Destination } from './types'

const COORD_DECIMALS = 6

// encodeURIComponent leaves ( and ) untouched, and the q= label is parenthesis-delimited.
const encodeLabel = (label: string): string =>
  encodeURIComponent(label).replace(/\(/g, '%28').replace(/\)/g, '%29')

// The coordinates appear twice on purpose: apps that read only the geo: path still get the point,
// apps that read q= get the point and the trail's name on the pin.
export function geoUri(point: Destination, label: string): string {
  const coords = `${point.lat.toFixed(COORD_DECIMALS)},${point.lng.toFixed(COORD_DECIMALS)}`
  return `geo:${coords}?q=${coords}(${encodeLabel(label)})`
}
