import { openURL } from 'expo-linking'
import { showToast } from '../components/toast'
import { logEvent } from '../log'
import { geoUri, type Destination } from './geoUri'

// The app's single outward door: the only module that may hand a URL to another app. A geo: URI
// dispatches ACTION_VIEW, so Android's own chooser decides which map app receives the destination.
// No canOpenURL pre-check: on Android 11+ it returns false for any scheme absent from a <queries>
// manifest block, which Expo's config cannot declare without a custom plugin.
export async function openMapApp(point: Destination, label: string): Promise<void> {
  try {
    await openURL(geoUri(point, label))
    logEvent('info', 'map', 'opened external map app')
  } catch (error) {
    logEvent('warn', 'map', 'map app launch failed', { error: String(error) })
    showToast('No map app found')
  }
}
