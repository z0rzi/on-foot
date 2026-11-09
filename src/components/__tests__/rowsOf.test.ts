import { rowsOf } from '../rowsOf'

describe('rowsOf', () => {
  test('splits five items into a full row of three and a row of two', () => {
    expect(rowsOf(['a', 'b', 'c', 'd', 'e'], 3)).toEqual([['a', 'b', 'c'], ['d', 'e']])
  })

  test('keeps three items on a single row', () => {
    expect(rowsOf(['a', 'b', 'c'], 3)).toEqual([['a', 'b', 'c']])
  })

  test('gives no rows for no items', () => {
    expect(rowsOf([], 3)).toEqual([])
  })
})
