import { screenAgrees, targetAgrees } from './settled'
import { findByLabel, type Bounds, type UiNode } from './uiDump'

export type TapTarget = { kind: 'still'; bounds: Bounds } | { kind: 'missing'; reason: string }

// The judge of the reads before a tap: the target once two reads agree on its bounds, so a tap
// during an animation does not land beside it; missing once the screen settled without it.
export function tapTarget(label: string, current: UiNode[], previous: UiNode[] | null): TapTarget | null {
  if (previous === null) return null
  const bounds = targetAgrees(label, previous, current)
  if (bounds) return { kind: 'still', bounds }
  const match = findByLabel(current, label)
  if (match.node === null && screenAgrees(previous, current)) return { kind: 'missing', reason: `no "${label}" on screen; labels seen: ${match.seen.join(' | ')}` }
  return null
}

// Why a target that never stood still across two reads inside the cap is not tapped.
export function targetAtCap(label: string, capS: number, polled: { read: UiNode[] | null; last: string }): string {
  if (polled.read && findByLabel(polled.read, label).node) return `"${label}" still moving after ${capS} s: not tapped`
  return `no "${label}" on screen after ${capS} s; ${polled.last}`
}
