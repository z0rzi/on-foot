import { backToMap, type ToMapIo } from '../toMap'

// The app's screens, the map at the bottom, as `state` reads the one in front: a back key closes
// an open dialog first, and a route left takes `lag` reads to be read as gone.
function phone(stack: string[], { dialog = false, lag = 0 } = {}) {
  const screens = [...stack]
  let open = dialog
  let stale: { route: string; reads: number } | null = null
  let t = 0
  const top = () => screens[screens.length - 1]
  const io: ToMapIo = {
    screen: async () => {
      if (stale && stale.reads > 0) {
        stale.reads--
        return stale.route
      }
      return top()
    },
    back: async () => {
      if (screens.length === 1) throw new Error('back pressed on the map: the app is left')
      if (open) {
        open = false
        return
      }
      stale = { route: top(), reads: lag }
      screens.pop()
    },
    sleep: async (ms) => {
      t += ms
    },
    now: () => t,
  }
  return io
}

describe('back to the map', () => {
  it('presses nothing when the map is in front', async () => {
    await expect(backToMap(phone(['/']))).resolves.toBe(0)
  })

  it('presses back, a screen at a time, until the map is in front', async () => {
    await expect(backToMap(phone(['/', '/trails', '/trail/7']))).resolves.toBe(2)
  })

  it('waits for the route to follow a back key before pressing again', async () => {
    await expect(backToMap(phone(['/', '/trails'], { lag: 3 }))).resolves.toBe(1)
  })

  it('presses again when a back key left the route as it was, as one closing a dialog does', async () => {
    await expect(backToMap(phone(['/', '/trails'], { dialog: true }))).resolves.toBe(2)
  })

  it('gives up after six presses, naming the screen in front', async () => {
    const deep = ['/', '/a', '/b', '/c', '/d', '/e', '/f', '/settings']
    await expect(backToMap(phone(deep))).rejects.toThrow('the map did not come back after 6 presses of back; /a in front')
  })
})
