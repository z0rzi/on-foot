import NetInfo, { type NetInfoState } from '@react-native-community/netinfo'
import type { ConnectivityStatus } from './types'

export type { NetInfoState }

export function toConnectivityStatus(state: NetInfoState): ConnectivityStatus {
  return {
    online: !!state.isConnected && state.isInternetReachable !== false,
    metered: state.type === 'cellular',
  }
}

export async function getConnectivity(): Promise<ConnectivityStatus> {
  return toConnectivityStatus(await NetInfo.fetch())
}
