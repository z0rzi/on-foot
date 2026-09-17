import { requestTrackingNotificationAccess } from '../location'
import { showToast } from '../components/toast'

let deniedHintShown = false

// The foreground-service notification is the visible sign that On Foot is recording. When Android
// will not show it, say so once per process rather than on every start.
export async function ensureTrackingNotificationAccess(): Promise<void> {
  if ((await requestTrackingNotificationAccess()) !== 'denied' || deniedHintShown) return
  deniedHintShown = true
  showToast("Notifications are off, so Android won't show that On Foot is recording.")
}
