import { appliedOpenHeight, sheetSnapPoints } from '../sheetSnapPoints'
import { sheetRest } from '../sheetRest'

// Pip row 44 dp alone, 20 dp over the 62 dp graph and its 12 dp gap; nav row 72 dp; a 48 dp button
// bar, taller than the 16 dp margin, so a 48 dp bottom inset.
const rest = (mode: 'free' | 'trail', graphShown: boolean, navRowHeight = 72) =>
  sheetRest({ mode, graphShown, navRowHeight, systemInset: 48 })
const base = { rest: rest('trail', false), detailsHeight: 200, windowHeight: 800 }

describe('sheetSnapPoints', () => {
  test('the first snap point is the resting card, collapsed', () => {
    expect(sheetSnapPoints(base).rest).toBe(44)
  })
  test('the first snap point is the resting card, the nav card', () => {
    expect(sheetSnapPoints({ ...base, rest: rest('free', false) }).rest).toBe(72)
  })
  test('open fits the pip row, the details and the nav row', () => {
    expect(sheetSnapPoints(base).open).toBe(316)
  })
  test('open fits the graph too when shown', () => {
    expect(sheetSnapPoints({ ...base, rest: rest('trail', true) }).open).toBe(366)
  })
  test('with no details the open card is the pip row and the nav row', () => {
    expect(sheetSnapPoints({ ...base, detailsHeight: 0 }).open).toBe(116)
  })
  test("open is capped so the card's top sits at 80% of the window, its bottom inset counted", () => {
    const { open } = sheetSnapPoints({ ...base, detailsHeight: 2000 })
    expect(open).toBe(592)
    expect(open + base.rest.bottomInset).toBe(640)
  })
  test('open stays above the resting position on a window too short for its cap', () => {
    const points = sheetSnapPoints({ rest: rest('trail', false, 0), detailsHeight: 0, windowHeight: 60 })
    expect(points.open).toBeGreaterThan(points.rest)
  })
})

describe('appliedOpenHeight', () => {
  test('a collapsed card takes the new measurement', () => {
    expect(appliedOpenHeight(300, 420, true)).toBe(420)
  })
  test('an open card keeps the height it opened at', () => {
    expect(appliedOpenHeight(300, 420, false)).toBe(300)
  })
})
