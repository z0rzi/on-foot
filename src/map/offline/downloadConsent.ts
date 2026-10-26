import { Alert } from 'react-native'
import { getConnectivity } from '../../net/netinfo'
import { evaluateDownloadGate, type GateDecision } from '../../net/gate'
import { readFreeDiskBytes } from './diskSpace'
import { downloadDecision } from './downloadDecision'
import { formatBytes } from '../../format/units'
import { logEvent } from '../../log'

// Probe connectivity and free disk space, then route the download as `downloadDecision` decides.
// Fail-open — a probe error (connectivity or disk) must not block a legitimate download.
// `estimatedBytes` is the total to download when known (null on the retry path); it drives
// both the disk check and the size shown in the metered prompt.
export async function guardDownload(
  estimatedBytes: number | null,
  proceed: () => void,
): Promise<void> {
  let gate: GateDecision
  try {
    gate = evaluateDownloadGate(await getConnectivity())
  } catch {
    gate = 'ok'
  }

  let freeBytes: number | null = null
  if (estimatedBytes !== null) {
    try {
      freeBytes = readFreeDiskBytes()
    } catch {
      freeBytes = null
    }
  }

  const decision = downloadDecision(gate, freeBytes, estimatedBytes)
  switch (decision.kind) {
    case 'offline':
      logEvent('warn', 'error', 'download refused, offline')
      Alert.alert('You\'re offline', 'Connect to the internet to download offline maps.')
      return
    case 'no-space':
      logEvent('warn', 'error', 'download refused, not enough space', {
        neededBytes: decision.neededBytes,
        freeBytes: decision.freeBytes,
      })
      Alert.alert(
        'Not enough space',
        `This download needs about ${formatBytes(decision.neededBytes)} of free space, but only ${formatBytes(decision.freeBytes)} is available. Free up some space and try again.`,
      )
      return
    case 'ask-metered': {
      const message = estimatedBytes
        ? `This download is about ${formatBytes(estimatedBytes)} and may use your mobile data. Continue?`
        : 'This download may use your mobile data. Continue?'
      Alert.alert('Mobile data', message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Download', onPress: proceed },
      ])
      return
    }
    case 'proceed':
      proceed()
  }
}
