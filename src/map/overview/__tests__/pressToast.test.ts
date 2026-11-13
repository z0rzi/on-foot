import { toastThrottle } from '../pressToast'

describe('the recording press toast, once per item within a few seconds (D114)', () => {
  it('shows the first toast for an item', () => expect(toastThrottle(3000)('trail-1', 0)).toBe(true))

  it('gives five quick taps on the same item one toast', () => {
    const due = toastThrottle(3000)
    expect([0, 300, 700, 1200, 2000].map((t) => due('trail-1', t))).toEqual([true, false, false, false, false])
  })

  it('shows it again once the window has passed since it was shown', () => {
    const due = toastThrottle(3000)
    due('trail-1', 0)
    expect(due('trail-1', 2999)).toBe(false)
    expect(due('trail-1', 3000)).toBe(true)
    expect(due('trail-1', 4000)).toBe(false)
  })

  it('names another item at once', () => {
    const due = toastThrottle(3000)
    due('trail-1', 0)
    expect(due('activity-4', 100)).toBe(true)
  })
})
