import { packDescriptor } from '../descriptor'

const style = { id: 'outdoors', label: 'Outdoors', url: 'mapbox://styles/x/outdoors', preview: 0 }
const bounds = { ne: [6.9, 45.9] as [number, number], sw: [6.8, 45.8] as [number, number] }

describe('packDescriptor', () => {
  test('names the pack after the trail and the layer, with the layer style url', () => {
    const descriptor = packDescriptor(7, style, bounds)
    expect(descriptor.id).toBe('offline:7:outdoors')
    expect(descriptor.styleUrl).toBe('mapbox://styles/x/outdoors')
  })

  test('covers the trail bounds as [ne, sw] at the hiking zoom range', () => {
    const descriptor = packDescriptor(7, style, bounds)
    expect(descriptor.bounds).toEqual([[6.9, 45.9], [6.8, 45.8]])
    expect(descriptor.minZoom).toBe(10)
    expect(descriptor.maxZoom).toBe(16)
  })
})
