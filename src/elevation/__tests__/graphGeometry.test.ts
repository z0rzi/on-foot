import { scrubShowsOnTouch } from '../graphGeometry'

// The top 24 dp of the plot lie under the control above it.
describe('scrubShowsOnTouch', () => {
  test('a touch below the covered band shows the scrub at once', () => {
    expect(scrubShowsOnTouch(24, 24)).toBe(true)
    expect(scrubShowsOnTouch(50, 24)).toBe(true)
  })
  test('a touch in the covered band shows nothing until it drags', () => {
    expect(scrubShowsOnTouch(0, 24)).toBe(false)
    expect(scrubShowsOnTouch(23.5, 24)).toBe(false)
  })
  test('with nothing covering the plot, every touch shows the scrub at once', () => {
    expect(scrubShowsOnTouch(0, 0)).toBe(true)
  })
})
