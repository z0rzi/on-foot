import { sheetIsOpen } from '../sheetIndex'

// The sheet's live index: 0 at the collapsed snap point, 1 at the open one, past 1 while a drag
// over-pulls the open position, below 0 while one over-drags the collapsed position.
describe('sheetIsOpen', () => {
  test('a sheet at its collapsed position is collapsed', () => {
    expect(sheetIsOpen(0)).toBe(false)
  })
  test('a sheet over-dragged below its collapsed position is collapsed', () => {
    expect(sheetIsOpen(-0.2)).toBe(false)
  })
  test('a sheet within a hundredth of its collapsed position is collapsed', () => {
    expect(sheetIsOpen(0.01)).toBe(false)
  })
  test('a sheet at its open position is open', () => {
    expect(sheetIsOpen(1)).toBe(true)
  })
  test('a sheet over-pulled past its open position is open', () => {
    expect(sheetIsOpen(1.3)).toBe(true)
  })
  test('a sheet off its collapsed position, mid-drag or mid-animation, is open', () => {
    expect(sheetIsOpen(0.5)).toBe(true)
    expect(sheetIsOpen(0.02)).toBe(true)
  })
})
