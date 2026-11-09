import { cameraPadding } from '../cameraPadding'
import { sheetRest } from '../sheetRest'

// Margin 24 dp above and below the subject, 100 dp on the sides. Pip row 20 dp over the 62 dp graph
// and its 12 dp gap, 44 dp alone, nav row 72 dp, the cards 16 dp above the window's bottom, a 10 dp
// gesture inset inside that margin.
const rest = (mode: 'free' | 'trail', graphShown: boolean) =>
  sheetRest({ mode, graphShown, navRowHeight: 72, systemInset: 10 })
const base = { topInset: 32, sheet: rest('trail', true) }

describe('cameraPadding', () => {
  test('with no pill, the subject clears the status bar and the collapsed card', () => {
    expect(cameraPadding({ ...base, pill: { kind: 'none', measured: null } })).toEqual({
      padding: [56, 100, 134, 100],
      settled: true,
    })
  })

  test('with a measured pill, the subject clears its bottom edge', () => {
    expect(cameraPadding({ ...base, pill: { kind: 'figures', measured: { kind: 'figures', bottom: 118 } } })).toEqual({
      padding: [142, 100, 134, 100],
      settled: true,
    })
  })

  test('a pill not measured yet is not settled: a fit waits for it', () => {
    expect(cameraPadding({ ...base, pill: { kind: 'trail', measured: null } }).settled).toBe(false)
  })

  test("a measure of another state's pill is not this pill's edge", () => {
    expect(cameraPadding({ ...base, pill: { kind: 'paused', measured: { kind: 'figures', bottom: 118 } } }).settled).toBe(false)
  })

  test('a measure left from a pill now gone is ignored', () => {
    expect(cameraPadding({ ...base, pill: { kind: 'none', measured: { kind: 'trail', bottom: 90 } } })).toEqual({
      padding: [56, 100, 134, 100],
      settled: true,
    })
  })

  describe('the bottom edge', () => {
    const bottom = (sheet: ReturnType<typeof rest>) =>
      cameraPadding({ topInset: 32, pill: { kind: 'none', measured: null }, sheet }).padding[2]

    test("with a graph, the subject clears the collapsed graph card's top, graph and margin included", () => {
      expect(bottom(rest('trail', true))).toBe(134)
    })
    test('with no graph, it clears the pip row', () => {
      expect(bottom(rest('trail', false))).toBe(84)
    })
    test("nothing shown, it clears the nav card's top", () => {
      expect(bottom(rest('free', false))).toBe(112)
    })
  })
})
