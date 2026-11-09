import { menuPlacement } from '../menuPlacement'

describe('menuPlacement', () => {
  const screen = { windowHeight: 800, gap: 6, marginTop: 24, marginBottom: 16 }

  test('opens upward when the menu fits above its button', () => {
    expect(menuPlacement({ ...screen, anchorTop: 600, anchorBottom: 644, menuHeight: 200 })).toEqual({
      top: 394,
    })
  })

  test('opens downward from a button near the top of the screen', () => {
    expect(menuPlacement({ ...screen, anchorTop: 100, anchorBottom: 144, menuHeight: 200 })).toEqual({
      top: 150,
    })
  })

  test('opens upward when the menu exactly fits above, top margin included', () => {
    expect(menuPlacement({ ...screen, anchorTop: 230, anchorBottom: 274, menuHeight: 200 })).toEqual({
      top: 24,
    })
  })

  test('opens downward one pixel short of fitting above', () => {
    expect(menuPlacement({ ...screen, anchorTop: 229, anchorBottom: 273, menuHeight: 200 })).toEqual({ top: 279 })
  })

  test('fitting neither way, it opens toward the larger side and stays on screen', () => {
    expect(menuPlacement({ ...screen, anchorTop: 300, anchorBottom: 344, menuHeight: 600 })).toEqual({
      top: 184,
    })
    expect(menuPlacement({ ...screen, anchorTop: 500, anchorBottom: 544, menuHeight: 600 })).toEqual({
      top: 24,
    })
  })

  test('a menu taller than the screen starts at the top margin', () => {
    expect(menuPlacement({ ...screen, anchorTop: 300, anchorBottom: 344, menuHeight: 1000 }).top).toBe(24)
  })
})
