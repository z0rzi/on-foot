import { overlayBottom, overlaysHidden, sheetHeightAbove } from '../overlayGeometry'

// An 800 dp root; the card 16 dp above a 24 dp system inset, so its bottom edge 40 dp above the root's
// bottom; the collapsed graph card 122 dp tall, the nav card 72 dp, the open card capped at 600 dp.
const ROOT = 800
const BOTTOM_INSET = 40
const cardTop = (cardHeight: number) => ROOT - BOTTOM_INSET - cardHeight

describe("the overlays ride the card's live top edge, 12 dp above it", () => {
  test('the collapsed graph card', () => {
    expect(overlayBottom(sheetHeightAbove(ROOT, cardTop(122)))).toBe(174)
  })
  test('the nav card', () => {
    expect(overlayBottom(sheetHeightAbove(ROOT, cardTop(72)))).toBe(124)
  })
  test('the open card, past half the screen, which hides them', () => {
    const height = sheetHeightAbove(ROOT, cardTop(600))
    expect(overlayBottom(height)).toBe(652)
    expect(overlaysHidden(height, ROOT)).toBe(true)
  })
  test("the card parked at gorhom's closed position, the container's height plus the bottom inset, is no edge", () => {
    const container = ROOT - BOTTOM_INSET
    expect(sheetHeightAbove(ROOT, container + BOTTOM_INSET)).toBe(0)
  })
})

describe('sheetHeightAbove', () => {
  test('is the root height below the sheet top', () => {
    expect(sheetHeightAbove(800, 654)).toBe(146)
  })
  test('is 0 before the root has laid out', () => {
    expect(sheetHeightAbove(0, 654)).toBe(0)
  })
  test('is 0 before the sheet has laid out', () => {
    expect(sheetHeightAbove(800, 0)).toBe(0)
  })
  test("is 0 against gorhom's container before it has laid out (its height still the -999 placeholder)", () => {
    expect(sheetHeightAbove(-999, 800)).toBe(0)
  })
  test('is 0 while the sheet is parked at its pre-layout position', () => {
    expect(sheetHeightAbove(800, 800)).toBe(0)
    expect(sheetHeightAbove(800, 900)).toBe(0)
  })
})

describe('overlayBottom', () => {
  test('rides 12 dp above the sheet top', () => {
    expect(overlayBottom(146)).toBe(158)
  })
  test('sits on the root bottom while there is no sheet edge to ride', () => {
    expect(overlayBottom(0)).toBe(0)
  })
})

describe('overlaysHidden', () => {
  test('a collapsed sheet keeps the overlays', () => {
    expect(overlaysHidden(146, 800)).toBe(false)
  })
  test('a sheet at exactly half the screen keeps them', () => {
    expect(overlaysHidden(400, 800)).toBe(false)
  })
  test('a sheet past half the screen hides them', () => {
    expect(overlaysHidden(401, 800)).toBe(true)
  })
  test('nothing is hidden before the root has laid out', () => {
    expect(overlaysHidden(0, 0)).toBe(false)
  })
})
