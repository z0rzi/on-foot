import { hasArea, type UiNode } from './uiDump'

// Down brings the rows below, up the rows above.
export type ScrollDirection = 'down' | 'up'

const SWIPE_MS = 600

const area = (n: UiNode) => (n.bounds.right - n.bounds.left) * (n.bounds.bottom - n.bounds.top)

export interface Swipe { x: number; from: number; to: number; ms: number }

// A drag, not a fling, over a third of the largest list on screen, inside it: what was on screen
// before keeps part of its place after, so a list read page by page misses no row. Null when
// nothing on screen scrolls.
export function scrollSwipe(nodes: UiNode[], direction: ScrollDirection): Swipe | null {
  const lists = nodes.filter((n) => n.scrollable && hasArea(n.bounds))
  if (lists.length === 0) return null
  const { left, top, right, bottom } = lists.reduce((a, b) => (area(b) > area(a) ? b : a)).bounds
  const height = bottom - top
  const x = Math.round((left + right) / 2)
  const [low, high] = [top + Math.round(height * 0.7), top + Math.round(height * 0.35)]
  const [from, to] = direction === 'down' ? [low, high] : [high, low]
  return { x, from, to, ms: SWIPE_MS }
}
