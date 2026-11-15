import { findByLabel, labelsOf, type Bounds, type UiNode } from './uiDump'

// The toolkit's own idle: a screen is settled when two reads in a row agree on what the caller
// looks at. A tap's target agrees on its bounds alone, so a ticking clock elsewhere does not hold
// it up; the screen after a tap agrees on every label and where it is.
export const sameBounds = (a: Bounds, b: Bounds) => a.left === b.left && a.top === b.top && a.right === b.right && a.bottom === b.bottom

export function targetAgrees(label: string, previous: UiNode[], current: UiNode[]): Bounds | null {
  const before = findByLabel(previous, label).node
  const now = findByLabel(current, label).node
  return before && now && sameBounds(before.bounds, now.bounds) ? now.bounds : null
}

const placedLabels = (nodes: UiNode[]) =>
  new Set(nodes.flatMap((n) => labelsOf(n).map((label) => `${label} [${n.bounds.left},${n.bounds.top}][${n.bounds.right},${n.bounds.bottom}]`)))

export function screenAgrees(previous: UiNode[], current: UiNode[]): boolean {
  const [a, b] = [placedLabels(previous), placedLabels(current)]
  return a.size === b.size && [...a].every((l) => b.has(l))
}
