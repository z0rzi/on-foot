import { backDismissesSheet, modalSheetOpen } from '../sheetBack'

describe('modalSheetOpen', () => {
  test('a dismissed modal sheet is closed', () => {
    expect(modalSheetOpen(-1)).toBe(false)
  })
  test('a presented modal sheet is open', () => {
    expect(modalSheetOpen(0)).toBe(true)
  })
})

describe('backDismissesSheet', () => {
  test('a closed sheet lets back through', () => {
    expect(backDismissesSheet({ open: false, focused: true })).toBe(false)
  })
  test('an open sheet takes back', () => {
    expect(backDismissesSheet({ open: true, focused: true })).toBe(true)
  })
  test('an open sheet under a pushed screen leaves back to the pushed screen', () => {
    expect(backDismissesSheet({ open: true, focused: false })).toBe(false)
  })
})
