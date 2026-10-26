import type { GateDecision } from '../../net/gate'
import { hasEnoughDiskSpace, requiredDiskSpace } from './diskSpace'

export type DownloadDecision =
  | { kind: 'offline' }
  | { kind: 'no-space'; neededBytes: number; freeBytes: number }
  | { kind: 'ask-metered' }
  | { kind: 'proceed' }

// Offline outranks disk space, which outranks the mobile-data prompt. An unknown free space or
// estimate skips the disk check rather than blocking the download.
export function downloadDecision(
  gate: GateDecision,
  freeBytes: number | null,
  estimate: number | null,
): DownloadDecision {
  if (gate === 'offline') return { kind: 'offline' }
  if (freeBytes !== null && estimate !== null && !hasEnoughDiskSpace(freeBytes, estimate)) {
    return { kind: 'no-space', neededBytes: requiredDiskSpace(estimate), freeBytes }
  }
  if (gate === 'metered') return { kind: 'ask-metered' }
  return { kind: 'proceed' }
}
