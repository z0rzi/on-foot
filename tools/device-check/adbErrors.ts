// What adb prints when the phone is not reachable: unplugged, offline after a USB drop, or not
// authorised. A call that hangs past its timeout counts too.
const LOST = /no devices\/emulators found|device '[^']*' not found|device not found|device offline|device unauthorized/i

export function isPhoneLost(result: { timedOut: boolean; stderr: string }): boolean {
  return result.timedOut || LOST.test(result.stderr)
}
