import { routeColouring } from '../routeColouring'
import { routeDisplay } from '../routeDisplay'
import { slopeBandColour } from '../slopeColour'
import { lightColors } from '../../theme/colors'
import type { ElePoint } from '../profile'

const seg = (eles: number[]): ElePoint[] => eles.map((ele, i) => ({ lat: 0, lng: i * 0.001, ele }))

describe('routeColouring', () => {
  it('returns undefined when there is no display', () => {
    expect(routeColouring(null, lightColors)).toBeUndefined()
  })

  it('returns undefined when the bands produce no runs, not []', () => {
    // Each segment has only one real elevation sample (a leading null-elevation point supplies
    // the distance), so no segment ever holds two consecutive samples to form a slope run — the
    // profile is valid and carries distance, but displaySlopeBands yields no bands at all.
    const segments: ElePoint[][] = [
      [{ lat: 0, lng: 0, ele: null }, { lat: 0, lng: 0.001, ele: 100 }],
      [{ lat: 0, lng: 1, ele: null }, { lat: 0, lng: 1.001, ele: 120 }],
    ]
    const display = routeDisplay('trail', segments, 0)!
    expect(display.bands).toEqual([])
    expect(routeColouring(display, lightColors)).toBeUndefined()
  })

  it('returns one coloured entry per slope run, carrying that band colour', () => {
    const segments = [seg([100, 140, 180, 150, 100])]
    const display = routeDisplay('trail', segments, 0)!
    expect(display.bands.length).toBeGreaterThan(0)

    const lines = routeColouring(display, lightColors)!
    expect(lines.length).toBe(display.bands.length)
    for (const [i, line] of lines.entries()) {
      expect(line.color).toBe(slopeBandColour(display.bands[i].band, lightColors))
      expect(line.coordinates.length).toBeGreaterThanOrEqual(2)
    }
  })
})
