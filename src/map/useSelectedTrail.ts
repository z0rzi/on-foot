import { Trail, trailsRepository } from '../data/trails'
import { useTrailsStore } from '../store/trailsStore'
import { currentRecordingPhase } from '../recording/recordingStore'
import { showToast } from '../components/toast'
import { useSelectedEntity } from './useSelectedEntity'

// A trail shown while recording is the recording's trail, which carries on along no trail.
function announceLostRecordingTrail(): void {
  if (currentRecordingPhase() !== 'idle') {
    showToast("The recording's trail is no longer available")
  }
}

export function useSelectedTrail(): Trail | null {
  const version = useTrailsStore((s) => s.version)
  return useSelectedEntity('trail', trailsRepository.getTrail, version, announceLostRecordingTrail)
}
