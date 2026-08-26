import { Alert } from 'react-native'
import { getConnectivity } from './netinfo'
import { evaluateDownloadGate, type GateDecision } from './gate'

// Read connectivity once and route the download: abort when offline, ask for consent on
// mobile data, proceed otherwise. Fail-open — a probe error must not block a legitimate
// download. `sizeLabel` (e.g. "24 MB") is shown in the metered prompt when known.
export async function guardDownload(sizeLabel: string | null, proceed: () => void): Promise<void> {
  let decision: GateDecision
  try {
    decision = evaluateDownloadGate(await getConnectivity())
  } catch {
    decision = 'ok'
  }

  if (decision === 'offline') {
    Alert.alert('You\'re offline', 'Connect to the internet to download offline maps.')
    return
  }

  if (decision === 'metered') {
    const message = sizeLabel
      ? `This download is about ${sizeLabel} and may use your mobile data. Continue?`
      : 'This download may use your mobile data. Continue?'
    Alert.alert('Mobile data', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Download', onPress: proceed },
    ])
    return
  }

  proceed()
}
