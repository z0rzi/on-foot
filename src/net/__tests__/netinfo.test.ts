import type { NetInfoState } from '../netinfo'
import { toConnectivityStatus } from '../netinfo'

const state = (s: any) => s as NetInfoState

describe('toConnectivityStatus', () => {
  test('connected with reachable internet is online', () => {
    expect(toConnectivityStatus(state({ isConnected: true, isInternetReachable: true })).online).toBe(true)
  })
  test('connected but internet definitively unreachable is offline', () => {
    expect(toConnectivityStatus(state({ isConnected: true, isInternetReachable: false })).online).toBe(false)
  })
  test('reachability still probing (null) is treated as online', () => {
    expect(toConnectivityStatus(state({ isConnected: true, isInternetReachable: null })).online).toBe(true)
  })
  test('no connection is offline', () => {
    expect(toConnectivityStatus(state({ isConnected: false, isInternetReachable: false })).online).toBe(false)
  })
  test('cellular is metered', () => {
    expect(toConnectivityStatus(state({ type: 'cellular', isConnected: true, isInternetReachable: true })).metered).toBe(true)
  })
  test('wifi is not metered', () => {
    expect(toConnectivityStatus(state({ type: 'wifi', isConnected: true, isInternetReachable: true })).metered).toBe(false)
  })
})
