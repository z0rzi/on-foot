// Whether a toast naming an item is due, for presses on the overview while recording: an item named
// less than `windowMs` ago is not named again. Android queues toasts, and repeated or wet taps must
// not stack them ahead of the recording's own (D114).
export function toastThrottle(windowMs: number): (key: string, now: number) => boolean {
  const shownAt = new Map<string, number>()
  return (key, now) => {
    const last = shownAt.get(key)
    if (last != null && now - last < windowMs) return false
    shownAt.set(key, now)
    return true
  }
}
