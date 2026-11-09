import { pipRow, sheetHeaderHeight } from '../sheetHeader'

// The plot is 62 dp tall, with 12 dp of the card under it.
describe('the card header', () => {
  test('over a graph, the pip row is laid out 20 dp and its 44 dp target reaches 24 dp down over the plot', () => {
    expect(pipRow(true)).toEqual({ height: 20, slop: 24 })
  })
  test('a graph sits between the pip row and a 12 dp gap, so it never rests on the card\'s bottom edge', () => {
    expect(sheetHeaderHeight(true)).toBe(94)
  })
  test('with no graph, the pip row is laid out as tall as its 44 dp target and reaches over nothing', () => {
    expect(pipRow(false)).toEqual({ height: 44, slop: 0 })
    expect(sheetHeaderHeight(false)).toBe(44)
  })
})
