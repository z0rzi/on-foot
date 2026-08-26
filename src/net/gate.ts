import type { ConnectivityStatus } from './types'

export type GateDecision = 'offline' | 'metered' | 'ok'

export function evaluateDownloadGate(status: ConnectivityStatus): GateDecision {
  if (!status.online) return 'offline'
  if (status.metered) return 'metered'
  return 'ok'
}
