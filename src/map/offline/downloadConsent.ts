import { Alert } from 'react-native'
import { getConnectivity } from '../../net/netinfo'
import { evaluateDownloadGate, type GateDecision } from '../../net/gate'
import { hasEnoughDiskSpace, readFreeDiskBytes, requiredDiskSpace } from './diskSpace'
import { formatBytes } from '../../format/units'
import { logEvent } from '../../log'

// Read connectivity once and route the download: abort when offline, block when the device
// lacks room for the estimated pack, ask for consent on mobile data, proceed otherwise.
// Fail-open — a probe error (connectivity or disk) must not block a legitimate download.
// `estimatedBytes` is the total to download when known (null on the retry path); it drives
// both the disk check and the size shown in the metered prompt.
export async function guardDownload(
  estimatedBytes: number | null,
  proceed: () => void,
): Promise<void> {
  let decision: GateDecision
  try {
    decision = evaluateDownloadGate(await getConnectivity())
  } catch {
    decision = 'ok'
  }

  if (decision === 'offline') {
    logEvent('warn', 'error', 'download refused, offline')
    Alert.alert('You\'re offline', 'Connect to the internet to download offline maps.')
    return
  }

  if (estimatedBytes !== null) {
    let freeBytes: number | null
    try {
      freeBytes = readFreeDiskBytes()
    } catch {
      freeBytes = null
    }
    if (freeBytes !== null && !hasEnoughDiskSpace(freeBytes, estimatedBytes)) {
      logEvent('warn', 'error', 'download refused, not enough space', {
        neededBytes: requiredDiskSpace(estimatedBytes),
        freeBytes,
      })
      Alert.alert(
        'Not enough space',
        `This download needs about ${formatBytes(requiredDiskSpace(estimatedBytes))} of free space, but only ${formatBytes(freeBytes)} is available. Free up some space and try again.`,
      )
      return
    }
  }

  if (decision === 'metered') {
    const message = estimatedBytes
      ? `This download is about ${formatBytes(estimatedBytes)} and may use your mobile data. Continue?`
      : 'This download may use your mobile data. Continue?'
    Alert.alert('Mobile data', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Download', onPress: proceed },
    ])
    return
  }

  proceed()
}
