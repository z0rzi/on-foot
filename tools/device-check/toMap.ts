// The map's route, as the app's `state` hook names the screen in front.
const MAP_ROUTE = '/'
const MAX_BACKS = 6
// How long a back key's screen change is waited for: a route follows the key within a frame or
// two, and a back key closing a dialog leaves it as it was.
const FOLLOW_MS = 2_000
const POLL_MS = 200

export interface ToMapIo {
  // The route in front, read through the `state` hook.
  screen(): Promise<string | null>
  back(): Promise<void>
  sleep(ms: number): Promise<void>
  now(): number
}

async function afterBack(io: ToMapIo, before: string | null): Promise<string | null> {
  const deadline = io.now() + FOLLOW_MS
  for (;;) {
    const screen = await io.screen()
    if (screen !== before || io.now() >= deadline) return screen
    await io.sleep(POLL_MS)
  }
}

// Presses back until the map is in front, reading the route through the hooks, never the screen;
// returns the presses it took. Back is never pressed on the map, where it would leave the app.
export async function backToMap(io: ToMapIo): Promise<number> {
  let screen = await io.screen()
  for (let presses = 0; ; presses++) {
    if (screen === MAP_ROUTE) return presses
    if (presses === MAX_BACKS) throw new Error(`the map did not come back after ${MAX_BACKS} presses of back; ${screen ?? 'no screen'} in front`)
    await io.back()
    screen = await afterBack(io, screen)
  }
}
