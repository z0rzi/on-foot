import { screenAgrees } from './settled'
import { findByLabel, labelsLine, type UiNode } from './uiDump'

// What a tap waits for: a named label to appear or go, or, with none named, the screen to settle.
export interface Expected { label: string; gone: boolean }

export type TapOutcome = { kind: 'appeared' | 'gone'; label: string; nodes: UiNode[] } | { kind: 'settled' | 'nothing-changed'; nodes: UiNode[] }

type AtCap = { kind: 'failed'; reason: string } | { kind: 'report'; report: string }

export const reached = (expected: Expected, nodes: UiNode[]) => (findByLabel(nodes, expected.label).node !== null) !== expected.gone

export const notReached = (expected: Expected, timeoutS: number, last: string) =>
  `"${expected.label}" ${expected.gone ? 'still there' : 'not there'} after ${timeoutS} s; ${last}`

// The judge of the reads after a tap or a scroll. `before` is the read it acted on: a screen that
// settles back to it is an action that changed nothing.
export function tapOutcome(expected: Expected | null, before: UiNode[]) {
  return (current: UiNode[], previous: UiNode[] | null): TapOutcome | null => {
    if (expected) return reached(expected, current) ? { kind: expected.gone ? 'gone' : 'appeared', label: expected.label, nodes: current } : null
    if (previous === null || !screenAgrees(previous, current)) return null
    return { kind: screenAgrees(before, current) ? 'nothing-changed' : 'settled', nodes: current }
  }
}

export function outcomeReport(outcome: TapOutcome, waitedS: number): string {
  const after = `after ${waitedS.toFixed(1)} s`
  const head =
    outcome.kind === 'appeared' || outcome.kind === 'gone'
      ? `"${outcome.label}" ${outcome.kind} ${after}`
      : outcome.kind === 'settled'
        ? `settled ${after}`
        : `nothing changed (settled ${after})`
  return `${head}\n${labelsLine(outcome.nodes)}`
}

// At the cap a named outcome that did not come fails; a screen that never settled is reported as
// last read, which is no failure: a ticking text or a spinner keeps a screen from ever agreeing.
export function outcomeAtCap(expected: Expected | null, capS: number, polled: { read: UiNode[] | null; last: string }): AtCap {
  if (expected) return { kind: 'failed', reason: notReached(expected, capS, polled.last) }
  const head = `not settled after ${capS} s`
  return { kind: 'report', report: polled.read ? `${head}\n${labelsLine(polled.read)}` : `${head}; ${polled.last}` }
}
