import { axisLayout } from '../axisLayout'
import { elevationAxis } from '../elevationAxis'

const PLOT = 62
// 11 sp labels, at font scale 1 and at the 1.3 accessibility size.
const SIZE = 11
const SIZE_FS13 = 14.3
// The spec's 2 dp between a label's digits and its gridline or the label below; a digit is 0.75 of the font size tall.
const GAP = 2
const DIGIT_HEIGHT = 0.75

describe('axisLayout', () => {
  it("puts the profile's lowest point on the plot's bottom edge and leaves 6 dp over its highest", () => {
    expect(axisLayout(elevationAxis(200, 300), SIZE, PLOT).y).toEqual({ low: 200, high: 300, top: 6, bottom: 62 })
  })

  it('lists the labels high to low, each with its gridline', () => {
    expect(axisLayout(elevationAxis(200, 300), SIZE, PLOT).labels.map((l) => [l.label, l.y])).toEqual([
      ['300 m', 6],
      ['250 m', 34],
      ['200 m', 62],
    ])
  })

  it('sits a label just above its gridline, inside the plot', () => {
    const [, middle, floor] = axisLayout(elevationAxis(200, 300), SIZE, PLOT).labels
    expect(middle.baseline).toBe(32)
    expect(floor.baseline).toBe(60)
  })

  it('sits a label just under a gridline too near the top for it to fit above', () => {
    const [top] = axisLayout(elevationAxis(200, 300), SIZE, PLOT).labels
    expect(top.baseline).toBeCloseTo(6 + GAP + DIGIT_HEIGHT * SIZE)
  })

  // The range the graph plots for the T-93 device-check trail (climb.gpx, 146.0–202.1 m).
  it('drops a top label that would land on the label below once under its gridline, with its gridline', () => {
    for (const size of [SIZE, SIZE_FS13]) {
      expect(axisLayout(elevationAxis(146, 202.1), size, PLOT).labels.map((l) => l.label)).toEqual(['180 m', '160 m'])
    }
  })

  it('never draws two labels over each other, at font scale 1 and 1.3', () => {
    for (const size of [SIZE, SIZE_FS13]) {
      for (let min = 140; min <= 160; min += 0.5) {
        for (let max = min + 10; max <= min + 80; max += 0.5) {
          const labels = axisLayout(elevationAxis(min, max), size, PLOT).labels
          for (let i = 1; i < labels.length; i++) {
            expect(labels[i - 1].baseline + GAP).toBeLessThanOrEqual(labels[i].baseline - DIGIT_HEIGHT * size)
          }
        }
      }
    }
  })

  it("keeps every label's digits inside the plot, at font scale 1 and 1.3", () => {
    for (const size of [SIZE, SIZE_FS13]) {
      for (const l of axisLayout(elevationAxis(200, 300), size, PLOT).labels) {
        expect(l.baseline - DIGIT_HEIGHT * size).toBeGreaterThanOrEqual(0)
        expect(l.baseline).toBeLessThanOrEqual(PLOT)
      }
    }
  })
})
