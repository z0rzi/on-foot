import { findByLabel, type Bounds, type UiNode } from './uiDump'

// The one control of the recording screen: the recording clock ticks every second, so that screen
// never idles long enough for `uiautomator dump`. RecordButton is the same control idle and
// recording, so its bounds from an idle dump stand for it while recording.
export const RECORD_BUTTON_LABELS = ['Start recording', 'Pause recording (press and hold)']

export type ScreenRead =
  | { kind: 'dump'; nodes: UiNode[]; xml: string }
  | { kind: 'recording' }
  | { kind: 'failed'; reason: string }

export type TapTarget = { kind: 'found'; bounds: Bounds; remembered: boolean } | { kind: 'missing'; reason: string }

export function tapTarget(label: string, screen: ScreenRead, rememberedRecordButton: Bounds | null): TapTarget {
  if (screen.kind === 'failed') return { kind: 'missing', reason: `no dump: ${screen.reason}` }
  if (screen.kind === 'recording') {
    if (!RECORD_BUTTON_LABELS.includes(label)) {
      return { kind: 'missing', reason: `the recording screen cannot be dumped; only the record button (${RECORD_BUTTON_LABELS.join(', ')}) can be tapped while recording` }
    }
    if (!rememberedRecordButton) {
      return { kind: 'missing', reason: 'the record button was never seen: take a shot or tap "Start recording" before recording' }
    }
    return { kind: 'found', bounds: rememberedRecordButton, remembered: true }
  }
  const match = findByLabel(screen.nodes, label)
  if (!match.node) return { kind: 'missing', reason: `no "${label}" on screen; labels seen: ${match.seen.join(' | ')}` }
  return { kind: 'found', bounds: match.node.bounds, remembered: false }
}

export function recordButtonIn(nodes: UiNode[]): Bounds | null {
  return findByLabel(nodes, RECORD_BUTTON_LABELS[0]).node?.bounds ?? null
}
